package com.intezo.qatar_app

import android.telephony.SmsManager
import io.flutter.plugin.common.MethodChannel
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "intezo.sms_gateway")
            .setMethodCallHandler { call, result ->
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
