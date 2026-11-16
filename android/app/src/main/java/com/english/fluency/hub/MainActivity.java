package com.english.fluency.hub;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int REQ_RECORD_AUDIO = 2042;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String activeSpeechId = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true;
                tts.setLanguage(Locale.US);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        dispatchTTSEvent(utteranceId, "start", "");
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        dispatchTTSEvent(utteranceId, "done", "");
                    }

                    @Override
                    public void onError(String utteranceId) {
                        dispatchTTSEvent(utteranceId, "error", "تعذر تشغيل محرك النطق على الجهاز.");
                    }
                });
            } else {
                ttsReady = false;
            }
        });

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AndroidTTSBridge(), "AndroidTTS");
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        dispatchMicPermissionState();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_RECORD_AUDIO) {
            dispatchMicPermissionState();
        }
    }

    private boolean isMicGranted() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void dispatchMicPermissionState() {
        boolean granted = isMicGranted();
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                String js = "window.__onAndroidMicPermission && window.__onAndroidMicPermission(" + granted + ");";
                getBridge().getWebView().evaluateJavascript(js, null);
            }
        });
    }

    private void dispatchTTSEvent(String speechId, String type, String detail) {
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                String safeId = speechId.replace("'", "");
                String safeDetail = detail.replace("'", "\\'");
                String js = "window.__onAndroidTTSEvent && window.__onAndroidTTSEvent('" + safeId + "','" + type + "','" + safeDetail + "');";
                getBridge().getWebView().evaluateJavascript(js, null);
            }
        });
    }

    @Override
    public void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }

    public class AndroidTTSBridge {
        @JavascriptInterface
        public boolean isReady() {
            return ttsReady && tts != null;
        }

        @JavascriptInterface
        public boolean isLanguageAvailable(String langTag) {
            if (!ttsReady || tts == null) return false;
            Locale loc = "ar".equalsIgnoreCase(langTag) || langTag.startsWith("ar")
                ? new Locale("ar", "SA")
                : Locale.US;
            int res = tts.isLanguageAvailable(loc);
            return res >= TextToSpeech.LANG_AVAILABLE;
        }

        @JavascriptInterface
        public void speak(String speechId, String text, String langTag, float rate) {
            if (!ttsReady || tts == null) {
                dispatchTTSEvent(speechId, "error", "محرك النطق غير جاهز على هذا الجهاز.");
                return;
            }
            activeSpeechId = speechId;
            Locale loc = "ar".equalsIgnoreCase(langTag) || langTag.startsWith("ar")
                ? new Locale("ar", "SA")
                : Locale.US;
            int avail = tts.isLanguageAvailable(loc);
            if (avail == TextToSpeech.LANG_MISSING_DATA || avail == TextToSpeech.LANG_NOT_SUPPORTED) {
                dispatchTTSEvent(speechId, "missing_lang", langTag);
                return;
            }
            tts.setLanguage(loc);
            tts.setSpeechRate(Math.max(0.4f, Math.min(1.5f, rate)));
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
            int code = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, speechId);
            if (code == TextToSpeech.ERROR) {
                dispatchTTSEvent(speechId, "error", "حدث خطأ أثناء النطق.");
            }
        }

        @JavascriptInterface
        public void stop() {
            if (tts != null) {
                tts.stop();
            }
            if (!activeSpeechId.isEmpty()) {
                dispatchTTSEvent(activeSpeechId, "done", "");
                activeSpeechId = "";
            }
        }

        @JavascriptInterface
        public void openInstallVoiceData() {
            runOnUiThread(() -> {
                try {
                    Intent installIntent = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                    startActivity(installIntent);
                } catch (Exception e) {
                    try {
                        startActivity(new Intent("com.android.settings.TTS_SETTINGS"));
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(android.net.Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public boolean hasRecordAudioPermission() {
            return isMicGranted();
        }

        @JavascriptInterface
        public void requestRecordAudioPermission() {
            runOnUiThread(() -> {
                if (isMicGranted()) {
                    dispatchMicPermissionState();
                } else {
                    ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[] { Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS },
                        REQ_RECORD_AUDIO
                    );
                }
            });
        }
    }
}
