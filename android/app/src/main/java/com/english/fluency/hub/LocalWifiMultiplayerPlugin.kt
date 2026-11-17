package com.english.fluency.hub

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.Inet4Address
import java.net.NetworkInterface
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap

@CapacitorPlugin(name = "LocalWifiMultiplayer")
class LocalWifiMultiplayerPlugin : Plugin() {
    companion object {
        private const val SERVICE_TYPE = "_fluencyhub._tcp."
        private const val DEFAULT_HTTP_PORT = 38421
    }

    private var hostServer: LocalWifiHostServer? = null
    private var activeHttpPort: Int = 0
    private var activeWsPort: Int = 0
    private var activeHostIp: String = ""
    private var registeredServiceName: String = ""

    private val nsdManager: NsdManager? by lazy {
        context.getSystemService(Context.NSD_SERVICE) as? NsdManager
    }
    private val wifiManager: WifiManager? by lazy {
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    }
    private val connectivityManager: ConnectivityManager? by lazy {
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    }

    private var multicastLock: WifiManager.MulticastLock? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private var isDiscovering = false
    private val resolveQueue = ArrayDeque<NsdServiceInfo>()
    private var isResolving = false
    private val resolveLock = Any()

    private val discoveredHosts = ConcurrentHashMap<String, JSObject>()

    @PluginMethod
    fun startHost(call: PluginCall) {
        val code = call.getString("privateCode")?.trim() ?: ""
        val name = call.getString("name")?.trim() ?: "متعلم"
        val avatarId = call.getString("avatarId")?.trim() ?: "avatar-scholar"
        val levelId = call.getString("levelId")?.trim() ?: "A1"

        if (!Regex("^\\d{6}$").matches(code)) {
            call.reject("Invalid 6-digit privateCode")
            return
        }

        // Stop any stale host cleanly before starting fresh
        stopHostInternal()

        val ip = detectLocalWifiOrHotspotIp()
        if (ip == null) {
            call.reject("لم يتم العثور على عنوان شبكة واي فاي أو نقطة اتصال نشطة. شغّل نقطة الاتصال أو اتصل بشبكة واي فاي أولاً.")
            return
        }

        var startedServer: LocalWifiHostServer? = null
        var chosenHttpPort = 0
        var chosenWsPort = 0
        var lastError: Exception? = null

        for (offset in 0..5) {
            val hPort = DEFAULT_HTTP_PORT + offset * 2
            val wPort = hPort + 1
            try {
                val candidate = LocalWifiHostServer(ip, hPort, wPort, code, name) { count ->
                    notifyHostStatusChanged(count)
                }
                candidate.start()
                startedServer = candidate
                chosenHttpPort = hPort
                chosenWsPort = wPort
                break
            } catch (ex: Exception) {
                lastError = ex
                try {
                    startedServer?.stop()
                } catch (_: Exception) {}
            }
        }

        if (startedServer == null) {
            call.reject("تعذر بدء خادم اللعب المحلي: ${lastError?.message ?: "المنافذ مشغولة"}")
            return
        }

        hostServer = startedServer
        activeHttpPort = chosenHttpPort
        activeWsPort = chosenWsPort
        activeHostIp = ip

        acquireMulticastLock()
        registerNsdService(code, name, avatarId, levelId, chosenHttpPort, chosenWsPort)
        registerNetworkWatcher()

        val status = buildHostStatusJson(startedServer.getConnectedPeerCount())
        notifyListeners("hostStatusChanged", status)
        call.resolve(status)
    }

    @PluginMethod
    fun stopHost(call: PluginCall) {
        stopHostInternal()
        val status = buildHostStatusJson(0)
        notifyListeners("hostStatusChanged", status)
        call.resolve(status)
    }

    @PluginMethod
    fun getHostStatus(call: PluginCall) {
        val count = hostServer?.getConnectedPeerCount() ?: 0
        call.resolve(buildHostStatusJson(count))
    }

    @PluginMethod
    fun startDiscovery(call: PluginCall) {
        acquireMulticastLock()
        registerNetworkWatcher()

        if (isDiscovering) {
            val ret = JSObject()
            ret.put("started", true)
            ret.put("hosts", getHostsArray())
            call.resolve(ret)
            return
        }

        discoveredHosts.clear()
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(regType: String) {
                isDiscovering = true
            }

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                val svcType = serviceInfo.serviceType ?: ""
                if (!svcType.contains("_fluencyhub._tcp")) return
                if (registeredServiceName.isNotEmpty() && serviceInfo.serviceName == registeredServiceName) {
                    return
                }
                enqueueResolve(serviceInfo)
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                val removed = discoveredHosts.remove(serviceInfo.serviceName)
                if (removed != null) {
                    emitDiscoveredHosts()
                }
            }

            override fun onDiscoveryStopped(serviceType: String) {
                isDiscovering = false
            }

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                isDiscovering = false
                try {
                    nsdManager?.stopServiceDiscovery(this)
                } catch (_: Exception) {}
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                isDiscovering = false
            }
        }

        discoveryListener = listener
        try {
            nsdManager?.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
            isDiscovering = true
            val ret = JSObject()
            ret.put("started", true)
            ret.put("hosts", getHostsArray())
            call.resolve(ret)
        } catch (ex: Exception) {
            isDiscovering = false
            call.reject("تعذر بدء البحث عبر الشبكة المحلية: ${ex.message}")
        }
    }

    @PluginMethod
    fun stopDiscovery(call: PluginCall) {
        stopDiscoveryInternal()
        call.resolve(JSObject().put("stopped", true))
    }

    @PluginMethod
    fun getDiscoveredHosts(call: PluginCall) {
        val ret = JSObject()
        ret.put("hosts", getHostsArray())
        call.resolve(ret)
    }

    @PluginMethod
    fun getLocalNetworkInfo(call: PluginCall) {
        val ip = detectLocalWifiOrHotspotIp() ?: ""
        val ret = JSObject()
        ret.put("ip", ip)
        ret.put("supported", true)
        call.resolve(ret)
    }

    private fun enqueueResolve(serviceInfo: NsdServiceInfo) {
        synchronized(resolveLock) {
            resolveQueue.addLast(serviceInfo)
            if (!isResolving) {
                processNextResolve()
            }
        }
    }

    private fun processNextResolve() {
        val next: NsdServiceInfo?
        synchronized(resolveLock) {
            next = resolveQueue.removeFirstOrNull()
            if (next == null) {
                isResolving = false
                return
            }
            isResolving = true
        }

        try {
            nsdManager?.resolveService(next, object : NsdManager.ResolveListener {
                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    processNextResolve()
                }

                override fun onServiceResolved(resolved: NsdServiceInfo) {
                    handleResolvedService(resolved)
                    processNextResolve()
                }
            })
        } catch (_: Exception) {
            processNextResolve()
        }
    }

    private fun handleResolvedService(resolved: NsdServiceInfo) {
        val hostAddr = resolved.host?.hostAddress?.replace(Regex("%.*$"), "") ?: return
        if (hostAddr == "127.0.0.1" || hostAddr.startsWith("169.254.") || hostAddr.contains(":")) {
            return
        }

        val attrs = resolved.attributes
        fun readAttr(key: String, fallback: String): String {
            val raw = attrs[key] ?: return fallback
            return try {
                String(raw, StandardCharsets.UTF_8)
            } catch (_: Exception) {
                fallback
            }
        }

        val code = readAttr("code", "")
        if (hostServer != null && code == hostServer?.hostCode) {
            return
        }
        val name = readAttr("name", resolved.serviceName ?: "مضيف محلي")
        val avatarId = readAttr("avatar", "avatar-scholar")
        val levelId = readAttr("level", "A1")
        val httpPort = readAttr("httpPort", resolved.port.toString()).toIntOrNull() ?: resolved.port
        val wsPort = readAttr("wsPort", (httpPort + 1).toString()).toIntOrNull() ?: (httpPort + 1)

        val item = JSObject().apply {
            put("serviceName", resolved.serviceName ?: "FFH-$code")
            put("privateCode", code)
            put("name", name)
            put("avatarId", avatarId)
            put("levelId", levelId)
            put("ip", hostAddr)
            put("httpPort", httpPort)
            put("wsPort", wsPort)
            put("httpUrl", "http://$hostAddr:$httpPort")
            put("wsUrl", "ws://$hostAddr:$wsPort")
            put("discoveredAt", System.currentTimeMillis())
        }

        discoveredHosts[resolved.serviceName ?: "$hostAddr:$httpPort"] = item
        emitDiscoveredHosts()
    }

    private fun registerNsdService(
        code: String,
        name: String,
        avatarId: String,
        levelId: String,
        httpPort: Int,
        wsPort: Int
    ) {
        unregisterNsdService()
        val serviceInfo = NsdServiceInfo().apply {
            serviceName = "FFH-$code"
            serviceType = SERVICE_TYPE
            port = httpPort
            setAttribute("code", code)
            setAttribute("name", name.take(24))
            setAttribute("avatar", avatarId)
            setAttribute("level", levelId)
            setAttribute("httpPort", httpPort.toString())
            setAttribute("wsPort", wsPort.toString())
        }

        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(info: NsdServiceInfo) {
                registeredServiceName = info.serviceName ?: "FFH-$code"
                notifyHostStatusChanged(hostServer?.getConnectedPeerCount() ?: 0)
            }

            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
            }

            override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {
                registeredServiceName = ""
            }

            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
            }
        }
        registrationListener = listener
        try {
            nsdManager?.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (_: Exception) {
        }
    }

    private fun unregisterNsdService() {
        val reg = registrationListener
        registrationListener = null
        registeredServiceName = ""
        if (reg != null) {
            try {
                nsdManager?.unregisterService(reg)
            } catch (_: Exception) {}
        }
    }

    private fun stopDiscoveryInternal() {
        val listener = discoveryListener
        discoveryListener = null
        isDiscovering = false
        synchronized(resolveLock) {
            resolveQueue.clear()
            isResolving = false
        }
        if (listener != null) {
            try {
                nsdManager?.stopServiceDiscovery(listener)
            } catch (_: Exception) {}
        }
        releaseMulticastLockIfIdle()
    }

    private fun stopHostInternal() {
        unregisterNsdService()
        try {
            hostServer?.stop()
        } catch (_: Exception) {}
        hostServer = null
        activeHttpPort = 0
        activeWsPort = 0
        activeHostIp = ""
        releaseMulticastLockIfIdle()
    }

    private fun acquireMulticastLock() {
        try {
            if (multicastLock == null) {
                multicastLock = wifiManager?.createMulticastLock("FluencyHubNsdLock")?.apply {
                    setReferenceCounted(false)
                }
            }
            if (multicastLock?.isHeld == false) {
                multicastLock?.acquire()
            }
        } catch (_: Exception) {}
    }

    private fun releaseMulticastLockIfIdle() {
        if (hostServer != null || isDiscovering) return
        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        } catch (_: Exception) {}
    }

    private fun registerNetworkWatcher() {
        if (networkCallback != null) return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                if (hostServer != null) {
                    notifyHostStatusChanged(hostServer?.getConnectedPeerCount() ?: 0)
                }
                if (isDiscovering) {
                    emitDiscoveredHosts()
                }
            }

            override fun onLost(network: Network) {
                if (hostServer != null) {
                    notifyHostStatusChanged(hostServer?.getConnectedPeerCount() ?: 0)
                }
            }
        }
        networkCallback = cb
        try {
            connectivityManager?.registerDefaultNetworkCallback(cb)
        } catch (_: Exception) {
            networkCallback = null
        }
    }

    private fun unregisterNetworkWatcher() {
        val cb = networkCallback
        networkCallback = null
        if (cb != null) {
            try {
                connectivityManager?.unregisterNetworkCallback(cb)
            } catch (_: Exception) {}
        }
    }

    private fun detectLocalWifiOrHotspotIp(): String? {
        val candidates = ArrayList<Pair<Int, String>>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val nif = interfaces.nextElement()
                if (!nif.isUp || nif.isLoopback || nif.isVirtual) continue
                val ifaceName = nif.name.lowercase()
                val addrs = nif.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val ip = addr.hostAddress ?: continue
                        if (!isPrivateIpv4(ip)) continue
                        val priority = when {
                            ip.startsWith("192.168.43.") || ip.startsWith("192.168.49.") -> 1
                            ifaceName.startsWith("ap") || ifaceName.startsWith("swlan") || ifaceName.contains("tether") -> 2
                            ifaceName.startsWith("wlan") -> 3
                            else -> 4
                        }
                        candidates.add(Pair(priority, ip))
                    }
                }
            }
        } catch (_: Exception) {
        }
        return candidates.minByOrNull { it.first }?.second
    }

    private fun isPrivateIpv4(ip: String): Boolean {
        if (ip.startsWith("192.168.") || ip.startsWith("10.")) return true
        val parts = ip.split(".")
        if (parts.size == 4 && parts[0] == "172") {
            val second = parts[1].toIntOrNull() ?: return false
            return second in 16..31
        }
        return false
    }

    private fun buildHostStatusJson(connectedCount: Int): JSObject {
        val active = hostServer != null
        return JSObject().apply {
            put("active", active)
            put("ip", if (active) activeHostIp else "")
            put("httpPort", if (active) activeHttpPort else 0)
            put("wsPort", if (active) activeWsPort else 0)
            put("httpUrl", if (active) "http://$activeHostIp:$activeHttpPort" else "")
            put("wsUrl", if (active) "ws://$activeHostIp:$activeWsPort" else "")
            put("connectedCount", connectedCount)
            put("serviceName", registeredServiceName)
        }
    }

    private fun getHostsArray(): JSArray {
        val arr = JSArray()
        val seenIps = HashSet<String>()
        for (h in discoveredHosts.values) {
            val key = "${h.optString("ip")}:${h.optInt("httpPort")}"
            if (seenIps.add(key)) {
                arr.put(h)
            }
        }
        return arr
    }

    private fun emitDiscoveredHosts() {
        val payload = JSObject().put("hosts", getHostsArray())
        notifyListeners("wifiHostsChanged", payload)
    }

    private fun notifyHostStatusChanged(connectedCount: Int) {
        notifyListeners("hostStatusChanged", buildHostStatusJson(connectedCount))
    }

    override fun handleOnDestroy() {
        stopDiscoveryInternal()
        stopHostInternal()
        unregisterNetworkWatcher()
        super.handleOnDestroy()
    }
}
