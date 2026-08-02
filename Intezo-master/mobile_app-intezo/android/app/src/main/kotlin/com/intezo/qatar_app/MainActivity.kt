package com.intezo.qatar_app

import android.telephony.SmsManager
import android.content.Context
import io.flutter.plugin.common.MethodChannel
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "intezo.sms_gateway")
            .setMethodCallHandler { call, result ->
                if (call.method == "configureGateway") {
                    val baseUrl = call.argument<String>("baseUrl")
                    val key = call.argument<String>("key")
                    val deviceId = call.argument<String>("deviceId")
                    if (baseUrl.isNullOrBlank() || key.isNullOrBlank() || deviceId.isNullOrBlank()) {
                        result.error("INVALID_ARGUMENT", "Gateway configuration is incomplete", null)
                        return@setMethodCallHandler
                    }
                    getSharedPreferences("intezo_gateway", Context.MODE_PRIVATE).edit()
                        .putString("base_url", baseUrl.trim().trimEnd('/'))
                        .putString("gateway_key", key.trim())
                        .putString("device_id", deviceId.trim())
                        .apply()
                    result.success(true)
                    return@setMethodCallHandler
                }
                if (call.method != "sendSms") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                val phone = call.argument<String>("phone")
                val message = call.argument<String>("message")
                if (phone.isNullOrBlank() || message.isNullOrBlank()) {
                    result.error("INVALID_ARGUMENT", "Phone and message are required", null)
                    return@setMethodCallHandler
                }
                try {
                    SmsManager.getDefault().sendTextMessage(phone, null, message, null, null)
                    result.success(true)
                } catch (error: Exception) {
                    result.error("SMS_SEND_FAILED", error.message, null)
                }
            }
    }
}
