package com.english.fluency.hub

import fi.iki.elonen.NanoHTTPD
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONArray
import org.json.JSONObject
import java.net.InetSocketAddress
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

class LocalWifiHostServer(
    val hostIp: String,
    val httpPort: Int,
    val wsPort: Int,
    val hostCode: String,
    val hostName: String,
    private val onPeersCountChanged: (Int) -> Unit
) {
    data class QuestionItem(
        val id: String,
        val lessonId: String,
        val levelId: String,
        val skillTag: String,
        val type: String,
        val prompt: String,
        val promptAr: String?,
        val audioText: String?,
        val options: List<String>?,
        val wordsToOrder: List<String>?,
        val answer: String,
        val explanation: String
    ) {
        fun toJson(): JSONObject {
            val obj = JSONObject()
            obj.put("id", id)
            obj.put("lesson_id", lessonId)
            obj.put("level_id", levelId)
            obj.put("skill_tag", skillTag)
            obj.put("type", type)
            obj.put("prompt", prompt)
            if (promptAr != null) obj.put("promptAr", promptAr)
            if (audioText != null) obj.put("audioText", audioText)
            if (options != null) {
                val arr = JSONArray()
                options.forEach { arr.put(it) }
                obj.put("options", arr)
            }
            if (wordsToOrder != null) {
                val arr = JSONArray()
                wordsToOrder.forEach { arr.put(it) }
                obj.put("wordsToOrder", arr)
            }
            obj.put("answer", answer)
            obj.put("explanation", explanation)
            return obj
        }
    }

    data class ClientRecord(
        var ws: WebSocket?,
        val privateCode: String,
        var name: String,
        var avatarId: String,
        var levelId: String,
        var xp: Int,
        var streak: Int,
        var completedLessons: Int,
        var avgSkill: Int,
        var unlockedLevels: List<String>,
        var status: String,
        var roomId: String?,
        var lastSeen: Long,
        val sessionToken: String
    ) {
        fun toPeerJson(): JSONObject {
            val obj = JSONObject()
            obj.put("privateCode", privateCode)
            obj.put("name", name)
            obj.put("avatarId", avatarId)
            obj.put("levelId", levelId)
            obj.put("status", status)
            obj.put("sameWifi", true)
            obj.put("xp", xp)
            obj.put("streak", streak)
            obj.put("completedLessons", completedLessons)
            obj.put("avgSkill", avgSkill)
            val arr = JSONArray()
            unlockedLevels.forEach { arr.put(it) }
            obj.put("unlockedLevels", arr)
            return obj
        }
    }

    data class PendingInvite(
        val inviteId: String,
        val fromCode: String,
        val fromName: String,
        val fromAvatar: String,
        val toCode: String,
        val mode: String,
        val useTimer: Boolean,
        val timerSeconds: Int,
        val levelId: String,
        val createdAt: Long,
        val expiresAt: Long,
        var expiryTask: ScheduledFuture<*>?
    ) {
        fun toJson(): JSONObject {
            val obj = JSONObject()
            obj.put("inviteId", inviteId)
            obj.put("fromCode", fromCode)
            obj.put("fromName", fromName)
            obj.put("fromAvatar", fromAvatar)
            obj.put("toCode", toCode)
            obj.put("mode", mode)
            obj.put("useTimer", useTimer)
            obj.put("timerSeconds", timerSeconds)
            obj.put("levelId", levelId)
            obj.put("createdAt", createdAt)
            obj.put("expiresAt", expiresAt)
            return obj
        }
    }

    data class RoomMember(
        val privateCode: String,
        val name: String,
        val avatarId: String,
        var status: String,
        var side: String,
        var isLeader: Boolean,
        var score: Int,
        var answeredCount: Int,
        val answeredIndices: MutableSet<Int> = HashSet()
    ) {
        fun toJson(): JSONObject {
            val obj = JSONObject()
            obj.put("privateCode", privateCode)
            obj.put("name", name)
            obj.put("avatarId", avatarId)
            obj.put("status", status)
            obj.put("side", side)
            obj.put("isLeader", isLeader)
            obj.put("score", score)
            obj.put("answeredCount", answeredCount)
            return obj
        }
    }

    data class JoinRequest(
        val requestId: String,
        val privateCode: String,
        val name: String,
        val avatarId: String,
        val side: String
    ) {
        fun toJson(): JSONObject {
            val obj = JSONObject()
            obj.put("requestId", requestId)
            obj.put("privateCode", privateCode)
            obj.put("name", name)
            obj.put("avatarId", avatarId)
            obj.put("side", side)
            return obj
        }
    }

    data class RoomState(
        val roomId: String,
        val teamCode: String,
        val teamName: String,
        val mode: String,
        val format: String,
        var leaderCode: String,
        var useTimer: Boolean,
        val timerSeconds: Int,
        val members: CopyOnWriteArrayList<RoomMember>,
        val joinRequests: CopyOnWriteArrayList<JoinRequest>,
        var status: String,
        var questions: List<QuestionItem>,
        var startedAt: Long? = null,
        var endedAt: Long? = null,
        var chatExpiresAt: Long? = null,
        var pausedByDisconnect: Boolean = false,
        var disconnectedPlayerName: String? = null
    ) {
        fun toJson(): JSONObject {
            val obj = JSONObject()
            obj.put("roomId", roomId)
            obj.put("teamCode", teamCode)
            obj.put("teamName", teamName)
            obj.put("mode", mode)
            obj.put("format", format)
            obj.put("leaderCode", leaderCode)
            obj.put("useTimer", useTimer)
            obj.put("timerSeconds", timerSeconds)
            val mArr = JSONArray()
            members.forEach { mArr.put(it.toJson()) }
            obj.put("members", mArr)
            val jrArr = JSONArray()
            joinRequests.forEach { jrArr.put(it.toJson()) }
            obj.put("joinRequests", jrArr)
            obj.put("status", status)
            val qArr = JSONArray()
            questions.forEach { qArr.put(it.toJson()) }
            obj.put("questions", qArr)
            if (startedAt != null) obj.put("startedAt", startedAt)
            if (endedAt != null) obj.put("endedAt", endedAt)
            if (chatExpiresAt != null) obj.put("chatExpiresAt", chatExpiresAt)
            obj.put("pausedByDisconnect", pausedByDisconnect)
            if (disconnectedPlayerName != null) obj.put("disconnectedPlayerName", disconnectedPlayerName)
            return obj
        }
    }

    private val random = SecureRandom()
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private val clientsByCode = ConcurrentHashMap<String, ClientRecord>()
    private val codeBySocket = ConcurrentHashMap<WebSocket, String>()
    private val invitesById = ConcurrentHashMap<String, PendingInvite>()
    private val roomsById = ConcurrentHashMap<String, RoomState>()
    private val roomMessages = ConcurrentHashMap<String, CopyOnWriteArrayList<JSONObject>>()
    private val pendingHttpEvents = ConcurrentHashMap<String, CopyOnWriteArrayList<JSONObject>>()

    private val httpServer = EmbeddedHttpServer(httpPort)
    private val wsServer = EmbeddedWsServer(wsPort)
    private var cleanupTask: ScheduledFuture<*>? = null

    fun start() {
        httpServer.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
        wsServer.isReuseAddr = true
        wsServer.start()
        cleanupTask = scheduler.scheduleAtFixedRate({
            try {
                val now = System.currentTimeMillis()
                val staleCodes = clientsByCode.entries
                    .filter { (_, rec) -> rec.ws == null && now - rec.lastSeen > 120_000L }
                    .map { it.key }
                if (staleCodes.isNotEmpty()) {
                    for (code in staleCodes) {
                        removeMemberFromRoom(code, null)
                        clientsByCode.remove(code)
                        pendingHttpEvents.remove(code)
                    }
                    broadcastWifiPeers()
                    notifyPeerCount()
                }
            } catch (_: Exception) {
            }
        }, 30, 30, TimeUnit.SECONDS)
    }

    fun stop() {
        try {
            cleanupTask?.cancel(true)
        } catch (_: Exception) {}
        try {
            invitesById.values.forEach { it.expiryTask?.cancel(true) }
            invitesById.clear()
        } catch (_: Exception) {}
        try {
            wsServer.stop(500)
        } catch (_: Exception) {}
        try {
            httpServer.stop()
        } catch (_: Exception) {}
        try {
            scheduler.shutdownNow()
        } catch (_: Exception) {}
    }

    fun getConnectedPeerCount(): Int = clientsByCode.size

    private fun notifyPeerCount() {
        try {
            onPeersCountChanged(clientsByCode.size)
        } catch (_: Exception) {}
    }

    private fun newToken(): String {
        val bytes = ByteArray(16)
        random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun sendToSocket(ws: WebSocket?, payload: JSONObject) {
        if (ws == null || !ws.isOpen) return
        try {
            ws.send(payload.toString())
        } catch (_: Exception) {
        }
    }

    private fun sendToCode(code: String, payload: JSONObject) {
        val client = clientsByCode[code] ?: return
        val ws = client.ws
        if (ws != null && ws.isOpen) {
            sendToSocket(ws, payload)
        } else {
            val queue = pendingHttpEvents.computeIfAbsent(code) { CopyOnWriteArrayList() }
            queue.add(payload)
            while (queue.size > 30) {
                queue.removeAt(0)
            }
        }
    }

    private fun broadcastWifiPeers() {
        val snapshot = clientsByCode.values.toList()
        for (viewer in snapshot) {
            val ws = viewer.ws
            if (ws == null || !ws.isOpen) continue
            val peersArr = JSONArray()
            for (peer in snapshot) {
                if (peer.privateCode != viewer.privateCode) {
                    peersArr.put(peer.toPeerJson())
                }
            }
            val msg = JSONObject()
            msg.put("type", "wifi:peers")
            msg.put("peers", peersArr)
            sendToSocket(ws, msg)
        }
    }

    private fun broadcastRoom(room: RoomState) {
        val payload = JSONObject()
        payload.put("type", "room:state")
        payload.put("room", room.toJson())
        for (member in room.members) {
            sendToCode(member.privateCode, payload)
        }
    }

    private fun maxPerSide(format: String): Int = when (format) {
        "1v1" -> 1
        "2v2" -> 2
        "3v3" -> 3
        else -> 4
    }

    private fun generateTeamCode(): String {
        var candidate: String
        do {
            candidate = "TM-${1000 + random.nextInt(9000)}"
        } while (roomsById.values.any { it.teamCode == candidate })
        return candidate
    }

    private fun removeMemberFromRoom(code: String, reasonText: String?) {
        val client = clientsByCode[code]
        val roomId = client?.roomId ?: return
        client.roomId = null
        client.status = "online"

        val room = roomsById[roomId] ?: return
        val leavingMember = room.members.find { it.privateCode == code }
        room.members.removeAll { it.privateCode == code }

        if (room.members.isEmpty()) {
            roomsById.remove(room.roomId)
            roomMessages.remove(room.roomId)
            return
        }

        if (room.leaderCode == code) {
            val newLeader = room.members.firstOrNull()
            if (newLeader != null) {
                room.leaderCode = newLeader.privateCode
                newLeader.isLeader = true
            }
        }

        if (room.status == "playing") {
            room.pausedByDisconnect = true
            room.disconnectedPlayerName = leavingMember?.name ?: "صديقك"
            val leftMsg = JSONObject()
            leftMsg.put("type", "room:player_left")
            leftMsg.put("leftCode", code)
            leftMsg.put("leftName", leavingMember?.name ?: "لاعب")
            leftMsg.put(
                "message",
                reasonText ?: if (room.format == "1v1") "غادر صديقك اللعبة" else "غادر ${leavingMember?.name ?: "لاعب"} اللعبة"
            )
            for (member in room.members) {
                sendToCode(member.privateCode, leftMsg)
            }
        }

        broadcastRoom(room)
    }

    private fun filterProfanity(input: String): String {
        var text = input.trim().take(200)
        for (bad in BAD_WORDS) {
            text = text.replace(Regex(Regex.escape(bad), RegexOption.IGNORE_CASE), "***")
        }
        return text
    }

    private fun normalizeAnswer(value: String): String {
        return value.lowercase(Locale.ROOT)
            .replace(Regex("[.!?,،؟]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun registerOrUpdateClient(
        ws: WebSocket?,
        code: String,
        name: String,
        avatarId: String,
        levelId: String,
        xp: Int,
        streak: Int,
        completedLessons: Int,
        avgSkill: Int,
        unlockedLevels: List<String>,
        providedToken: String?
    ): Pair<ClientRecord?, String?> {
        if (!Regex("^\\d{6}$").matches(code)) {
            return Pair(null, "الرقم الخاص يجب أن يتكون من 6 أرقام.")
        }

        val existing = clientsByCode[code]
        if (existing != null) {
            val activeWsConflict = existing.ws != null && existing.ws != ws && existing.ws!!.isOpen
            val tokenMatches = !providedToken.isNullOrEmpty() && providedToken == existing.sessionToken
            if (activeWsConflict && !tokenMatches) {
                return Pair(null, "يوجد جهاز آخر على نفس شبكة الواي فاي يستخدم هذا الرقم الخاص! يرجى تغييره.")
            }
            if (ws != null && existing.ws != null && existing.ws != ws && tokenMatches) {
                try {
                    existing.ws?.close()
                } catch (_: Exception) {}
            }
        }

        val token = existing?.sessionToken ?: newToken()
        val rec = ClientRecord(
            ws = ws ?: existing?.ws,
            privateCode = code,
            name = name.trim().ifEmpty { existing?.name ?: "متعلم" }.take(32),
            avatarId = avatarId.ifEmpty { existing?.avatarId ?: "avatar-scholar" },
            levelId = levelId.ifEmpty { existing?.levelId ?: "A1" },
            xp = xp,
            streak = streak,
            completedLessons = completedLessons,
            avgSkill = avgSkill,
            unlockedLevels = unlockedLevels.ifEmpty { listOf("A1") },
            status = if (existing?.roomId != null) "in_game" else "online",
            roomId = existing?.roomId,
            lastSeen = System.currentTimeMillis(),
            sessionToken = token
        )
        clientsByCode[code] = rec
        if (ws != null) {
            val prevCode = codeBySocket[ws]
            if (prevCode != null && prevCode != code) {
                removeMemberFromRoom(prevCode, null)
                clientsByCode.remove(prevCode)
            }
            codeBySocket[ws] = code
        }
        notifyPeerCount()
        return Pair(rec, null)
    }

    private fun handleWsMessage(ws: WebSocket, msg: JSONObject) {
        val type = msg.optString("type", "")
        if (type == "register") {
            val code = msg.optString("privateCode", "").trim()
            val name = msg.optString("name", "متعلم")
            val avatarId = msg.optString("avatarId", "avatar-scholar")
            val levelId = msg.optString("levelId", "A1")
            val xp = msg.optInt("xp", 0)
            val streak = msg.optInt("streak", 0)
            val completedLessons = msg.optInt("completedLessons", 0)
            val avgSkill = msg.optInt("avgSkill", 75)
            val token = msg.optString("sessionToken", "")
            val ulArr = msg.optJSONArray("unlockedLevels")
            val unlocked = mutableListOf<String>()
            if (ulArr != null) {
                for (i in 0 until ulArr.length()) {
                    unlocked.add(ulArr.optString(i))
                }
            } else {
                unlocked.add(levelId)
            }

            val (rec, err) = registerOrUpdateClient(
                ws, code, name, avatarId, levelId, xp, streak, completedLessons, avgSkill, unlocked, token
            )
            if (rec == null) {
                val errObj = JSONObject()
                errObj.put("type", "register:error")
                errObj.put("code", if (err?.contains("6 أرقام") == true) "INVALID_CODE" else "CODE_CONFLICT")
                errObj.put("message", err ?: "خطأ في التسجيل")
                sendToSocket(ws, errObj)
                return
            }

            val okObj = JSONObject()
            okObj.put("type", "register:ok")
            okObj.put("privateCode", rec.privateCode)
            okObj.put("sessionToken", rec.sessionToken)
            okObj.put("networkKey", "wifi-host-$hostIp")
            sendToSocket(ws, okObj)
            broadcastWifiPeers()

            if (rec.roomId != null) {
                val room = roomsById[rec.roomId]
                if (room != null) {
                    room.pausedByDisconnect = false
                    val stateMsg = JSONObject()
                    stateMsg.put("type", "room:state")
                    stateMsg.put("room", room.toJson())
                    sendToSocket(ws, stateMsg)

                    val histArr = JSONArray()
                    roomMessages[room.roomId]?.forEach { histArr.put(it) }
                    val histMsg = JSONObject()
                    histMsg.put("type", "chat:history")
                    histMsg.put("messages", histArr)
                    sendToSocket(ws, histMsg)
                }
            }
            return
        }

        val senderCode = codeBySocket[ws] ?: return
        val sender = clientsByCode[senderCode] ?: return
        sender.lastSeen = System.currentTimeMillis()

        when (type) {
            "discover_wifi" -> {
                val peersArr = JSONArray()
                clientsByCode.values
                    .filter { it.privateCode != senderCode }
                    .forEach { peersArr.put(it.toPeerJson()) }
                val res = JSONObject()
                res.put("type", "wifi:peers")
                res.put("peers", peersArr)
                sendToSocket(ws, res)
            }

            "search_peers" -> {
                val q = msg.optString("query", "").trim().lowercase(Locale.ROOT)
                val scope = msg.optString("scope", "wifi")
                val peersArr = JSONArray()
                clientsByCode.values
                    .filter { p ->
                        p.privateCode != senderCode && (q.isEmpty() ||
                            p.privateCode.contains(q) ||
                            p.name.lowercase(Locale.ROOT).contains(q) ||
                            p.levelId.lowercase(Locale.ROOT) == q)
                    }
                    .take(30)
                    .forEach { peersArr.put(it.toPeerJson()) }
                val res = JSONObject()
                res.put("type", "peers:search_result")
                res.put("peers", peersArr)
                res.put("query", q)
                res.put("scope", scope)
                sendToSocket(ws, res)
            }

            "lookup_peer" -> {
                val targetCode = msg.optString("targetCode", "").trim()
                if (!Regex("^\\d{6}$").matches(targetCode) || targetCode == senderCode) {
                    val err = JSONObject()
                    err.put("type", "peer:status")
                    err.put("error", "أدخل رقماً صحيحاً من 6 أرقام غير رقمك الخاص.")
                    sendToSocket(ws, err)
                    return
                }
                val target = clientsByCode[targetCode]
                val peerJson = target?.toPeerJson() ?: JSONObject().apply {
                    put("privateCode", targetCode)
                    put("name", "صديق غير متصل")
                    put("avatarId", "avatar-scholar")
                    put("levelId", "A1")
                    put("status", "offline")
                }
                val res = JSONObject()
                res.put("type", "peer:status")
                res.put("peer", peerJson)
                sendToSocket(ws, res)
            }

            "challenge:send" -> {
                val toCode = msg.optString("toCode", "").trim()
                val mode = if (msg.optString("mode") == "online") "online" else "wifi"
                val useTimer = msg.optBoolean("useTimer", true)
                val timerSeconds = msg.optInt("timerSeconds", 15)

                if (!Regex("^\\d{6}$").matches(toCode) || toCode == senderCode) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "challenge:error")
                        put("message", "الرقم الخاص غير صالح أو يطابق رقمك.")
                    })
                    return
                }

                val target = clientsByCode[toCode]
                if (target == null) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "challenge:error")
                        put("message", "الصديق غير متصل على المضيف حالياً.")
                    })
                    return
                }

                val invite = createInvite(sender, target, mode, useTimer, timerSeconds)
                sendToSocket(ws, JSONObject().apply {
                    put("type", "challenge:sent")
                    put("invite", invite.toJson())
                })
                sendToCode(target.privateCode, JSONObject().apply {
                    put("type", "challenge:incoming")
                    put("invite", invite.toJson())
                })
            }

            "challenge:respond" -> {
                val inviteId = msg.optString("inviteId", "")
                val accept = msg.optBoolean("accept", false)
                val invite = invitesById[inviteId] ?: return
                if (invite.toCode != senderCode) return

                invite.expiryTask?.cancel(false)
                invitesById.remove(inviteId)

                if (!accept) {
                    sendToCode(invite.fromCode, JSONObject().apply {
                        put("type", "challenge:declined")
                        put("inviteId", inviteId)
                        put("message", "تم رفض التحدي")
                    })
                    return
                }

                val challenger = clientsByCode[invite.fromCode] ?: return
                val acceptor = clientsByCode[invite.toCode] ?: return

                if (challenger.roomId != null) removeMemberFromRoom(challenger.privateCode, null)
                if (acceptor.roomId != null) removeMemberFromRoom(acceptor.privateCode, null)

                val roomId = "ROOM-${System.currentTimeMillis()}-${random.nextInt(1000)}"
                val questions = getQuestionsForLevel(invite.levelId)
                val room = RoomState(
                    roomId = roomId,
                    teamCode = generateTeamCode(),
                    teamName = "تحدي 1 ضد 1 (Wi-Fi)",
                    mode = "wifi",
                    format = "1v1",
                    leaderCode = challenger.privateCode,
                    useTimer = invite.useTimer,
                    timerSeconds = invite.timerSeconds,
                    members = CopyOnWriteArrayList(
                        listOf(
                            RoomMember(challenger.privateCode, challenger.name, challenger.avatarId, "in_game", "A", true, 0, 0),
                            RoomMember(acceptor.privateCode, acceptor.name, acceptor.avatarId, "in_game", "B", false, 0, 0)
                        )
                    ),
                    joinRequests = CopyOnWriteArrayList(),
                    status = "playing",
                    questions = questions,
                    startedAt = System.currentTimeMillis()
                )
                roomsById[roomId] = room
                roomMessages[roomId] = CopyOnWriteArrayList()
                challenger.roomId = roomId
                challenger.status = "in_game"
                acceptor.roomId = roomId
                acceptor.status = "in_game"

                broadcastWifiPeers()
                broadcastRoom(room)
            }

            "team:create" -> {
                if (sender.roomId != null) removeMemberFromRoom(sender.privateCode, null)
                val teamName = msg.optString("teamName", "فريق ${sender.name}").trim().take(30)
                val rawFormat = msg.optString("format", "2v2")
                val format = if (rawFormat in listOf("1v1", "2v2", "3v3", "4v4")) rawFormat else "2v2"
                val useTimer = msg.optBoolean("useTimer", true)

                val roomId = "TEAM-${System.currentTimeMillis()}-${random.nextInt(1000)}"
                val room = RoomState(
                    roomId = roomId,
                    teamCode = generateTeamCode(),
                    teamName = teamName,
                    mode = "wifi",
                    format = format,
                    leaderCode = sender.privateCode,
                    useTimer = useTimer,
                    timerSeconds = 15,
                    members = CopyOnWriteArrayList(
                        listOf(RoomMember(sender.privateCode, sender.name, sender.avatarId, "online", "A", true, 0, 0))
                    ),
                    joinRequests = CopyOnWriteArrayList(),
                    status = "waiting",
                    questions = emptyList()
                )
                roomsById[roomId] = room
                roomMessages[roomId] = CopyOnWriteArrayList()
                sender.roomId = roomId
                broadcastRoom(room)
            }

            "team:join_request" -> {
                val query = msg.optString("codeOrLeader", "").trim().uppercase(Locale.ROOT)
                val side = if (msg.optString("side") == "B") "B" else "A"
                val room = roomsById.values.firstOrNull { r ->
                    r.status == "waiting" && (r.teamCode.uppercase(Locale.ROOT) == query || r.leaderCode == query)
                }
                if (room == null) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "team:error")
                        put("message", "لم يتم العثور على فريق مفتوح بهذا الكود أو رقم القائد.")
                    })
                    return
                }
                val limit = maxPerSide(room.format)
                if (room.members.count { it.side == side } >= limit) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "team:error")
                        put("message", "هذا الفريق ممتلئ بالفعل (الحد الأقصى $limit لاعبين).")
                    })
                    return
                }
                if (room.members.any { it.privateCode == sender.privateCode }) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "room:state")
                        put("room", room.toJson())
                    })
                    return
                }
                if (room.joinRequests.none { it.privateCode == sender.privateCode }) {
                    room.joinRequests.add(
                        JoinRequest(
                            requestId = "JR-${System.currentTimeMillis()}-${random.nextInt(1000)}",
                            privateCode = sender.privateCode,
                            name = sender.name,
                            avatarId = sender.avatarId,
                            side = side
                        )
                    )
                }
                sendToSocket(ws, JSONObject().apply {
                    put("type", "team:notice")
                    put("message", "تم إرسال طلب الانضمام إلى قائد فريق \"${room.teamName}\" — بانتظار موافقته.")
                })
                broadcastRoom(room)
            }

            "team:approve_join" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                if (room.leaderCode != sender.privateCode) return

                val requestId = msg.optString("requestId", "")
                val approve = msg.optBoolean("approve", false)
                val sideOverride = msg.optString("side", "")
                val reqItem = room.joinRequests.find { it.requestId == requestId } ?: return
                room.joinRequests.removeAll { it.requestId == requestId }

                if (!approve) {
                    sendToCode(reqItem.privateCode, JSONObject().apply {
                        put("type", "team:error")
                        put("message", "تم رفض طلب انضمامك إلى فريق \"${room.teamName}\".")
                    })
                    broadcastRoom(room)
                    return
                }

                val joiner = clientsByCode[reqItem.privateCode]
                if (joiner == null) {
                    broadcastRoom(room)
                    return
                }
                val targetSide = if (sideOverride == "B" || sideOverride == "A") sideOverride else reqItem.side
                val limit = maxPerSide(room.format)
                if (room.members.count { it.side == targetSide } >= limit) {
                    sendToCode(room.leaderCode, JSONObject().apply {
                        put("type", "team:error")
                        put("message", "الفريق وصل للحد الأقصى ($limit).")
                    })
                    broadcastRoom(room)
                    return
                }

                if (joiner.roomId != null && joiner.roomId != room.roomId) {
                    removeMemberFromRoom(joiner.privateCode, null)
                }
                joiner.roomId = room.roomId
                room.members.add(RoomMember(joiner.privateCode, joiner.name, joiner.avatarId, "online", targetSide, false, 0, 0))
                broadcastRoom(room)

                val histArr = JSONArray()
                roomMessages[room.roomId]?.forEach { histArr.put(it) }
                sendToCode(joiner.privateCode, JSONObject().apply {
                    put("type", "chat:history")
                    put("messages", histArr)
                })
            }

            "team:set_timer" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                if (room.leaderCode != sender.privateCode || room.status != "waiting") return
                room.useTimer = msg.optBoolean("useTimer", true)
                broadcastRoom(room)
            }

            "team:switch_side" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                if (room.status != "waiting") return
                val targetCode = msg.optString("targetCode", sender.privateCode).ifEmpty { sender.privateCode }
                if (targetCode != sender.privateCode && room.leaderCode != sender.privateCode) return
                val member = room.members.find { it.privateCode == targetCode } ?: return
                val nextSide = if (member.side == "A") "B" else "A"
                if (room.members.count { it.side == nextSide } >= maxPerSide(room.format)) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "team:error")
                        put("message", "الفريق المقابل ممتلئ لهذا الوضع.")
                    })
                    return
                }
                member.side = nextSide
                broadcastRoom(room)
            }

            "team:start", "team:play_again" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                if (room.leaderCode != sender.privateCode) return
                if (room.members.size < 2) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "team:error")
                        put("message", "يلزم وجود لاعبين اثنين على الأقل لبدء المباراة.")
                    })
                    return
                }
                if (room.members.none { it.side == "A" } || room.members.none { it.side == "B" }) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "team:error")
                        put("message", "يرجى وضع لاعب واحد على الأقل في الفريق المنافس قبل البدء.")
                    })
                    return
                }

                room.status = "playing"
                room.pausedByDisconnect = false
                room.disconnectedPlayerName = null
                room.startedAt = System.currentTimeMillis()
                room.endedAt = null
                room.chatExpiresAt = null
                room.questions = getQuestionsForLevel(sender.levelId)
                for (m in room.members) {
                    m.score = 0
                    m.answeredCount = 0
                    m.answeredIndices.clear()
                    m.status = "in_game"
                    clientsByCode[m.privateCode]?.status = "in_game"
                }
                broadcastWifiPeers()
                broadcastRoom(room)
            }

            "team:leave" -> {
                removeMemberFromRoom(sender.privateCode, null)
                broadcastWifiPeers()
            }

            "game:answer" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                if (room.status != "playing") return
                val member = room.members.find { it.privateCode == sender.privateCode } ?: return

                val rawIndex = msg.optInt("questionIndex", member.answeredCount)
                val qIdx = max(0, min(room.questions.size - 1, rawIndex))
                if (member.answeredIndices.contains(qIdx)) {
                    return // Authoritative duplicate-score guard
                }
                member.answeredIndices.add(qIdx)

                val qItem = room.questions.getOrNull(qIdx)
                val hasSubmitted = msg.has("submittedAnswer") && !msg.isNull("submittedAnswer")
                val isCorrect = if (hasSubmitted && qItem != null) {
                    normalizeAnswer(msg.optString("submittedAnswer", "")) == normalizeAnswer(qItem.answer)
                } else {
                    msg.optBoolean("isCorrect", false)
                }

                val answeredCount = min(room.questions.size, max(member.answeredCount + 1, msg.optInt("answeredCount", member.answeredCount + 1)))
                member.answeredCount = answeredCount
                if (isCorrect) member.score += 1

                if (room.members.all { it.answeredCount >= room.questions.size }) {
                    room.status = "finished"
                    room.endedAt = System.currentTimeMillis()
                    room.chatExpiresAt = System.currentTimeMillis() + 60_000L
                    for (m in room.members) {
                        m.status = "online"
                        clientsByCode[m.privateCode]?.status = "online"
                    }
                    broadcastWifiPeers()
                }
                broadcastRoom(room)
            }

            "chat:send" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                val expires = room.chatExpiresAt
                if (expires != null && System.currentTimeMillis() > expires) {
                    sendToSocket(ws, JSONObject().apply {
                        put("type", "chat:closed")
                        put("message", "انتهت مهلة الشات بعد نهاية المباراة (60 ثانية).")
                    })
                    return
                }
                val rawText = msg.optString("text", "").trim()
                if (rawText.isEmpty()) return

                val cleanText = filterProfanity(rawText)
                val rawChan = msg.optString("channel", "all")
                val channel = if (rawChan in listOf("team", "all", "private")) rawChan else "all"
                val recipientCode = msg.optString("recipientCode", "").ifEmpty { null }
                val senderMember = room.members.find { it.privateCode == sender.privateCode }

                val timeStr = SimpleDateFormat("hh:mm a", Locale("ar")).format(Date())
                val chatMsg = JSONObject().apply {
                    put("id", "MSG-${System.currentTimeMillis()}-${random.nextInt(1000)}")
                    put("roomId", room.roomId)
                    put("channel", channel)
                    put("senderCode", sender.privateCode)
                    put("senderName", sender.name)
                    if (senderMember != null) put("senderSide", senderMember.side)
                    if (recipientCode != null) put("recipientCode", recipientCode)
                    put("text", cleanText)
                    put("timestamp", timeStr)
                }

                val history = roomMessages.computeIfAbsent(room.roomId) { CopyOnWriteArrayList() }
                history.add(chatMsg)
                while (history.size > 50) history.removeAt(0)

                val out = JSONObject().apply {
                    put("type", "chat:message")
                    put("message", chatMsg)
                }
                for (m in room.members) {
                    if (channel == "team" && m.side != senderMember?.side) continue
                    if (channel == "private" && m.privateCode != sender.privateCode && m.privateCode != recipientCode) continue
                    sendToCode(m.privateCode, out)
                }
            }

            "chat:clear" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                if (room.leaderCode != sender.privateCode) return
                roomMessages[room.roomId]?.clear()
                val cleared = JSONObject().put("type", "chat:cleared")
                for (m in room.members) sendToCode(m.privateCode, cleared)
            }

            "webrtc:signal" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                val expires = room.chatExpiresAt
                if (expires != null && System.currentTimeMillis() > expires) return
                val toCode = msg.optString("toCode", "")
                if (room.members.none { it.privateCode == toCode }) return
                sendToCode(toCode, JSONObject().apply {
                    put("type", "webrtc:signal")
                    put("fromCode", sender.privateCode)
                    put("signal", msg.opt("signal"))
                })
            }

            "voice:speaking" -> {
                val room = sender.roomId?.let { roomsById[it] } ?: return
                val speaking = msg.optBoolean("speaking", false)
                val talkToAll = msg.optBoolean("talkToAll", false)
                val senderMember = room.members.find { it.privateCode == sender.privateCode }
                for (m in room.members) {
                    if (m.privateCode == sender.privateCode) continue
                    if (!talkToAll && senderMember != null && m.side != senderMember.side) continue
                    sendToCode(m.privateCode, JSONObject().apply {
                        put("type", "voice:speaking")
                        put("fromCode", sender.privateCode)
                        put("speaking", speaking)
                    })
                }
            }
        }
    }

    private fun createInvite(
        sender: ClientRecord,
        target: ClientRecord,
        mode: String,
        useTimer: Boolean,
        timerSeconds: Int
    ): PendingInvite {
        val inviteId = "INV-${System.currentTimeMillis()}-${random.nextInt(1000)}"
        val now = System.currentTimeMillis()
        val expiresAt = now + 30_000L
        val invite = PendingInvite(
            inviteId = inviteId,
            fromCode = sender.privateCode,
            fromName = sender.name,
            fromAvatar = sender.avatarId,
            toCode = target.privateCode,
            mode = mode,
            useTimer = useTimer,
            timerSeconds = timerSeconds,
            levelId = sender.levelId,
            createdAt = now,
            expiresAt = expiresAt,
            expiryTask = null
        )
        invitesById[inviteId] = invite
        invite.expiryTask = scheduler.schedule({
            val pending = invitesById.remove(inviteId) ?: return@schedule
            sendToCode(pending.fromCode, JSONObject().apply {
                put("type", "challenge:expired")
                put("inviteId", inviteId)
                put("message", "لم يتم الرد")
            })
            sendToCode(pending.toCode, JSONObject().apply {
                put("type", "challenge:expired")
                put("inviteId", inviteId)
                put("message", "انتهت مهلة طلب التحدي (30 ثانية)")
            })
        }, 30, TimeUnit.SECONDS)
        return invite
    }

    private inner class EmbeddedWsServer(port: Int) : WebSocketServer(InetSocketAddress("0.0.0.0", port)) {
        override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
            // Wait for register frame
        }

        override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
            val clientCode = codeBySocket.remove(conn) ?: return
            val client = clientsByCode[clientCode]
            if (client != null && client.ws == conn) {
                removeMemberFromRoom(clientCode, null)
                clientsByCode.remove(clientCode)
                pendingHttpEvents.remove(clientCode)
                broadcastWifiPeers()
                notifyPeerCount()
            }
        }

        override fun onMessage(conn: WebSocket, message: String) {
            try {
                val obj = JSONObject(message)
                handleWsMessage(conn, obj)
            } catch (_: Exception) {
            }
        }

        override fun onError(conn: WebSocket?, ex: Exception?) {
        }

        override fun onStart() {
        }
    }

    private inner class EmbeddedHttpServer(port: Int) : NanoHTTPD("0.0.0.0", port) {
        private fun jsonResponse(status: Response.IStatus, obj: JSONObject): Response {
            val resp = newFixedLengthResponse(status, "application/json; charset=utf-8", obj.toString())
            resp.addHeader("Access-Control-Allow-Origin", "*")
            resp.addHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            resp.addHeader("Access-Control-Allow-Headers", "Content-Type,Authorization")
            return resp
        }

        private fun readBodyJson(session: IHTTPSession): JSONObject {
            val map = HashMap<String, String>()
            session.parseBody(map)
            val raw = map["postData"] ?: "{}"
            return try {
                JSONObject(raw)
            } catch (_: Exception) {
                JSONObject()
            }
        }

        override fun serve(session: IHTTPSession): Response {
            if (session.method == Method.OPTIONS) {
                val empty = newFixedLengthResponse(Response.Status.NO_CONTENT, "text/plain", "")
                empty.addHeader("Access-Control-Allow-Origin", "*")
                empty.addHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
                empty.addHeader("Access-Control-Allow-Headers", "Content-Type,Authorization")
                return empty
            }

            val uri = session.uri ?: "/"
            val params = session.parms ?: emptyMap()

            return when {
                uri == "/api/health" -> {
                    val obj = JSONObject().apply {
                        put("ok", true)
                        put("isHost", true)
                        put("hostIp", hostIp)
                        put("httpPort", httpPort)
                        put("wsPort", wsPort)
                        put("hostCode", hostCode)
                        put("hostName", hostName)
                        put("peers", clientsByCode.size)
                        put("rooms", roomsById.size)
                    }
                    jsonResponse(Response.Status.OK, obj)
                }

                uri == "/api/peers/heartbeat" && session.method == Method.POST -> {
                    val body = readBodyJson(session)
                    val code = body.optString("privateCode", "").trim()
                    val name = body.optString("name", "متعلم")
                    val avatarId = body.optString("avatarId", "avatar-scholar")
                    val levelId = body.optString("levelId", "A1")
                    val xp = body.optInt("xp", 0)
                    val streak = body.optInt("streak", 0)
                    val completedLessons = body.optInt("completedLessons", 0)
                    val avgSkill = body.optInt("avgSkill", 75)
                    val token = body.optString("sessionToken", "")
                    val ulArr = body.optJSONArray("unlockedLevels")
                    val unlocked = mutableListOf<String>()
                    if (ulArr != null) {
                        for (i in 0 until ulArr.length()) unlocked.add(ulArr.optString(i))
                    } else {
                        unlocked.add(levelId)
                    }

                    val (rec, err) = registerOrUpdateClient(
                        null, code, name, avatarId, levelId, xp, streak, completedLessons, avgSkill, unlocked, token
                    )
                    if (rec == null) {
                        return jsonResponse(
                            Response.Status.CONFLICT,
                            JSONObject().apply {
                                put("code", "CODE_CONFLICT")
                                put("error", err ?: "تعارض في الرقم الخاص")
                            }
                        )
                    }

                    val queue = pendingHttpEvents[code]
                    val evArr = JSONArray()
                    if (queue != null) {
                        while (queue.isNotEmpty()) {
                            evArr.put(queue.removeAt(0))
                        }
                    }

                    jsonResponse(
                        Response.Status.OK,
                        JSONObject().apply {
                            put("ok", true)
                            put("privateCode", code)
                            put("sessionToken", rec.sessionToken)
                            put("events", evArr)
                        }
                    )
                }

                uri == "/api/peers/wifi" -> {
                    val self = params["self"]?.trim() ?: ""
                    val peersArr = JSONArray()
                    clientsByCode.values
                        .filter { it.privateCode != self }
                        .forEach { peersArr.put(it.toPeerJson()) }
                    jsonResponse(
                        Response.Status.OK,
                        JSONObject().apply {
                            put("peers", peersArr)
                            put("hostIp", hostIp)
                            put("wsPort", wsPort)
                        }
                    )
                }

                uri == "/api/peers/search" -> {
                    val self = params["self"]?.trim() ?: ""
                    val q = params["q"]?.trim()?.lowercase(Locale.ROOT) ?: ""
                    val peersArr = JSONArray()
                    clientsByCode.values
                        .filter { p ->
                            p.privateCode != self && (q.isEmpty() ||
                                p.privateCode.contains(q) ||
                                p.name.lowercase(Locale.ROOT).contains(q) ||
                                p.levelId.lowercase(Locale.ROOT) == q)
                        }
                        .take(30)
                        .forEach { peersArr.put(it.toPeerJson()) }
                    jsonResponse(Response.Status.OK, JSONObject().put("peers", peersArr))
                }

                uri.startsWith("/api/peers/lookup/") -> {
                    val targetCode = uri.removePrefix("/api/peers/lookup/").trim()
                    val self = params["self"]?.trim() ?: ""
                    if (!Regex("^\\d{6}$").matches(targetCode) || (self.isNotEmpty() && targetCode == self)) {
                        return jsonResponse(
                            Response.Status.BAD_REQUEST,
                            JSONObject().put("error", "أدخل رقماً صحيحاً من 6 أرقام غير رقمك الخاص.")
                        )
                    }
                    val target = clientsByCode[targetCode]
                    val peerJson = target?.toPeerJson() ?: JSONObject().apply {
                        put("privateCode", targetCode)
                        put("name", "صديق غير متصل")
                        put("avatarId", "avatar-scholar")
                        put("levelId", "A1")
                        put("status", "offline")
                    }
                    jsonResponse(Response.Status.OK, JSONObject().put("peer", peerJson))
                }

                uri == "/api/challenges/send" && session.method == Method.POST -> {
                    val body = readBodyJson(session)
                    val fromCode = body.optString("fromCode", "").trim()
                    val toCode = body.optString("toCode", "").trim()
                    val mode = if (body.optString("mode") == "online") "online" else "wifi"
                    val useTimer = body.optBoolean("useTimer", true)
                    val timerSeconds = body.optInt("timerSeconds", 15)

                    val sender = clientsByCode[fromCode]
                    if (sender == null) {
                        return jsonResponse(
                            Response.Status.BAD_REQUEST,
                            JSONObject().put("error", "يرجى الانتظار لحظة حتى يكتمل تسجيل جهازك مع المضيف.")
                        )
                    }
                    if (!Regex("^\\d{6}$").matches(toCode) || toCode == fromCode) {
                        return jsonResponse(
                            Response.Status.BAD_REQUEST,
                            JSONObject().put("error", "الرقم الخاص غير صالح أو يطابق رقمك.")
                        )
                    }
                    val target = clientsByCode[toCode]
                    if (target == null) {
                        return jsonResponse(
                            Response.Status.NOT_FOUND,
                            JSONObject().put("error", "الصديق غير متصل بالمضيف حالياً.")
                        )
                    }

                    val invite = createInvite(sender, target, mode, useTimer, timerSeconds)
                    sendToCode(target.privateCode, JSONObject().apply {
                        put("type", "challenge:incoming")
                        put("invite", invite.toJson())
                    })
                    jsonResponse(
                        Response.Status.OK,
                        JSONObject().apply {
                            put("ok", true)
                            put("invite", invite.toJson())
                        }
                    )
                }

                else -> jsonResponse(Response.Status.NOT_FOUND, JSONObject().put("error", "Not found"))
            }
        }
    }

    private fun getQuestionsForLevel(levelId: String): List<QuestionItem> {
        val base = OFFLINE_BANK[levelId] ?: OFFLINE_BANK["A1"]!!
        val extra = if (levelId == "A1") OFFLINE_BANK["A2"]!! else OFFLINE_BANK["A1"]!!
        val combined = ArrayList(base)
        for (q in extra) {
            if (combined.size >= 10) break
            if (combined.none { it.id == q.id }) combined.add(q)
        }
        combined.shuffle(random)
        return combined.take(10).map { q ->
            if (q.type == "mcq" && q.options != null) {
                q.copy(options = q.options.shuffled(random))
            } else {
                q
            }
        }
    }

    companion object {
        private val BAD_WORDS = listOf(
            "idiot", "stupid", "dumb", "shut up", "loser", "fool",
            "fuck", "shit", "bitch", "asshole", "bastard", "crap", "damn", "wtf",
            "حمار", "غبي", "تافه", "كلب", "أحمق", "حقير", "وسخ", "قذر", "لعنة"
        )

        private val OFFLINE_BANK: Map<String, List<QuestionItem>> = mapOf(
            "A1" to listOf(
                QuestionItem("MP-A1-1", "A1-L1", "A1", "vocab", "mcq", "Good morning", "اختر المعنى العربي الصحيح:", "Good morning", listOf("صباح الخير", "تصبح على خير", "مع السلامة", "شكراً لك"), null, "صباح الخير", "Good morning تعني صباح الخير."),
                QuestionItem("MP-A1-2", "A1-L2", "A1", "grammar", "mcq", "She ____ a diligent student.", "أكمل الجملة بالفعل المساعد الصحيح:", null, listOf("are", "is", "am", "be"), null, "is", "الضمير She يأخذ الفعل المساعد is."),
                QuestionItem("MP-A1-3", "A1-L3", "A1", "vocab", "tf", "هل معنى \"Library\" هو \"مكتبة\"؟", "صح أم خطأ:", "Library", listOf("صح", "خطأ"), null, "صح", "Library تعني مكتبة للقراءة واستعارة الكتب."),
                QuestionItem("MP-A1-4", "A1-L4", "A1", "sentence_building", "order", "رتب الكلمات: أنا أذهب إلى المدرسة كل يوم", "اضغط الكلمات بالترتيب الصحيح:", null, null, listOf("go", "I", "every", "to", "school", "day"), "I go to school every day", "الفاعل I يليه الفعل go ثم المكان والزمان."),
                QuestionItem("MP-A1-5", "A1-L5", "A1", "vocab", "mcq", "Breakfast", "اختر المعنى الصحيح:", "Breakfast", listOf("وجبة العشاء", "وجبة الإفطار", "مشروب بارد", "سوق الطعام"), null, "وجبة الإفطار", "Breakfast تعني وجبة الفطور في الصباح."),
                QuestionItem("MP-A1-6", "A1-L6", "A1", "grammar", "mcq", "They ____ playing football now.", "اختر الصيغة الصحيحة للمضارع المستمر:", null, listOf("is", "am", "are", "was"), null, "are", "الضمير الجمع They يأخذ are."),
                QuestionItem("MP-A1-7", "A1-L7", "A1", "vocab", "mcq", "Friendly", "ما معنى هذه الصفة؟", "Friendly", listOf("غاضب", "بطيء", "ودود", "بعيد"), null, "ودود", "Friendly تعني شخص لطيف وودود."),
                QuestionItem("MP-A1-8", "A1-L8", "A1", "reading", "mcq", "Ali wakes up at 6 AM. He drinks tea and reads a book before work.", "ماذا يفعل علي قبل العمل؟", null, listOf("ينام حتى الظهر", "يلعب كرة القدم", "يسافر بالقطار", "يشرب الشاي ويقرأ كتاباً"), null, "يشرب الشاي ويقرأ كتاباً", "النص يذكر بوضوح أنه يشرب الشاي ويقرأ كتاباً."),
                QuestionItem("MP-A1-9", "A1-L8", "A1", "vocab", "tf", "هل معنى \"Journey\" هو \"مطبخ\"؟", "صح أم خطأ:", "Journey", listOf("صح", "خطأ"), null, "خطأ", "Journey تعني رحلة، بينما مطبخ يعني Kitchen."),
                QuestionItem("MP-A1-10", "A1-L8", "A1", "sentence_building", "order", "رتب الكلمات: الطقس جميل اليوم", "اضغط الكلمات بالترتيب الصحيح:", null, null, listOf("is", "The", "today", "weather", "nice"), "The weather is nice today", "The weather is nice today جملة اسمية صحيحة.")
            ),
            "A2" to listOf(
                QuestionItem("MP-A2-1", "A2-L1", "A2", "grammar", "mcq", "Yesterday, we ____ our grandparents.", "اختر الفعل الماضي الصحيح:", null, listOf("visit", "visited", "visiting", "will visit"), null, "visited", "كلمة Yesterday تدل على الماضي البسيط."),
                QuestionItem("MP-A2-2", "A2-L2", "A2", "vocab", "mcq", "Healthy", "اختر المعنى العربي الصحيح:", "Healthy", listOf("مريض", "مكلف", "صحي", "صعب"), null, "صحي", "Healthy تعني صحي ومفيد للجسم."),
                QuestionItem("MP-A2-3", "A2-L3", "A2", "grammar", "mcq", "This book is ____ than that one.", "اختر صيغة المقارنة الصحيحة:", null, listOf("most interesting", "interesting", "interestinger", "more interesting"), null, "more interesting", "الصفة الطويلة تأخذ more ... than في المقارنة."),
                QuestionItem("MP-A2-4", "A2-L4", "A2", "sentence_building", "order", "رتب الكلمات: أستطيع التحدث بالإنجليزية جيداً", "كوّن الجملة الصحيحة:", null, null, listOf("speak", "I", "well", "can", "English"), "I can speak English well", "can يتبعها الفعل في المصدر speak."),
                QuestionItem("MP-A2-5", "A2-L5", "A2", "vocab", "mcq", "Appointment", "ما معنى هذه الكلمة؟", "Appointment", listOf("إجازة طويلة", "موعد محدد", "وجبة خفيفة", "هاتف ذكي"), null, "موعد محدد", "Appointment تعني موعد مثل موعد طبيب أو اجتماع."),
                QuestionItem("MP-A2-6", "A2-L6", "A2", "vocab", "tf", "هل معنى \"Improve\" هو \"يحسّن أو يطوّر\"؟", "صح أم خطأ:", "Improve", listOf("صح", "خطأ"), null, "صح", "Improve تعني يحسّن أو يطور."),
                QuestionItem("MP-A2-7", "A2-L7", "A2", "grammar", "mcq", "We are going to ____ a new project next week.", "اختر الفعل المناسب بعد going to:", null, listOf("started", "starting", "start", "starts"), null, "start", "بعد going to يأتي الفعل في المصدر دائماً."),
                QuestionItem("MP-A2-8", "A2-L8", "A2", "reading", "mcq", "Sara saves money every month because she plans to travel next summer.", "لماذا تدخر سارة المال؟", null, listOf("لشراء هاتف فقط", "لأنها لا تحب العمل", "لتدفع غرامة", "لأنها تخطط للسفر الصيف القادم"), null, "لأنها تخطط للسفر الصيف القادم", "النص يذكر she plans to travel next summer."),
                QuestionItem("MP-A2-9", "A2-L8", "A2", "vocab", "tf", "هل معنى \"Borrow\" هو \"يبيع\"؟", "صح أم خطأ:", "Borrow", listOf("صح", "خطأ"), null, "خطأ", "Borrow تعني يستعير، أما يبيع فتعني Sell."),
                QuestionItem("MP-A2-10", "A2-L8", "A2", "sentence_building", "order", "رتب الكلمات: هل تحب شرب القهوة؟", "كوّن السؤال الصحيح:", null, null, listOf("you", "Do", "coffee", "like", "drinking"), "Do you like drinking coffee", "السؤال في المضارع البسيط يبدأ بـ Do.")
            )
        )
    }
}
