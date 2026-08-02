package com.intezo.qatar_app

import android.telephony.SmsManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class SmsGatewayFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Thread { registerToken(token) }.start()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["type"] != "sms_gateway_job") return
        val jobId = message.data["jobId"] ?: return
        Thread { processJob(jobId) }.start()
    }

    private fun processJob(jobId: String) {
        val preferences = getSharedPreferences("intezo_gateway", MODE_PRIVATE)
        val baseUrl = preferences.getString("base_url", null) ?: return
        val key = preferences.getString("gateway_key", null) ?: return
        try {
            val job = requestJob("$baseUrl/sms-gateway/jobs/$jobId/claim", key)
                .optJSONObject("job") ?: return
            val phone = job.optString("phone")
            val code = job.optString("code")
            if (phone.isBlank() || code.isBlank()) return
            SmsManager.getDefault().sendTextMessage(
                phone,
                null,
                "Intezo verification code: $code. Do not share this code.",
                null,
                null
            )
            sendResult(baseUrl, key, jobId, true, null)
        } catch (error: Exception) {
            sendResult(baseUrl, key, jobId, false, error.message ?: "Android SMS send failed")
        }
    }

    private fun registerToken(token: String) {
        val preferences = getSharedPreferences("intezo_gateway", MODE_PRIVATE)
        val baseUrl = preferences.getString("base_url", null) ?: return
        val key = preferences.getString("gateway_key", null) ?: return
        val deviceId = preferences.getString("device_id", null) ?: return
        val connection = (URL("$baseUrl/sms-gateway/register").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15000
            readTimeout = 15000
            setRequestProperty("X-SMS-Gateway-Key", key)
            setRequestProperty("Content-Type", "application/json")
        }
        try {
            val payload = JSONObject()
                .put("deviceId", deviceId)
                .put("fcmToken", token)
                .put("enabled", true)
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            connection.inputStream.close()
        } finally {
            connection.disconnect()
        }
    }

    private fun requestJob(endpoint: String, key: String): JSONObject {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15000
            readTimeout = 15000
            setRequestProperty("X-SMS-Gateway-Key", key)
            setRequestProperty("Accept", "application/json")
        }
        return try {
            responseBody(connection)
        } finally {
            connection.disconnect()
        }
    }

    private fun sendResult(baseUrl: String, key: String, jobId: String, success: Boolean, error: String?) {
        val connection = (URL("$baseUrl/sms-gateway/jobs/$jobId/result").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15000
            readTimeout = 15000
            setRequestProperty("X-SMS-Gateway-Key", key)
            setRequestProperty("Content-Type", "application/json")
        }
        val payload = JSONObject().put("success", success)
        if (!success) payload.put("error", error ?: "Android SMS send failed")
        connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        connection.inputStream.close()
        connection.disconnect()
    }

    private fun responseBody(connection: HttpURLConnection): JSONObject {
        val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
        val body = BufferedReader(InputStreamReader(stream)).use { it.readText() }
        if (connection.responseCode !in 200..299) throw IllegalStateException("Gateway request failed (${connection.responseCode})")
        return JSONObject(body)
    }
}
