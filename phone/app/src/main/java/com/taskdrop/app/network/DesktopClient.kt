package com.taskdrop.app.network

import android.content.Context
import android.util.Log
import com.taskdrop.app.data.QueuedItem
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DesktopClient(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val healthClient = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .writeTimeout(3, TimeUnit.SECONDS)
        .callTimeout(3, TimeUnit.SECONDS)
        .build()
    private val sendClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .callTimeout(5, TimeUnit.SECONDS)
        .build()

    fun getServerAddress(): String =
        preferences.getString(SERVER_ADDRESS_KEY, DEFAULT_SERVER_ADDRESS) ?: DEFAULT_SERVER_ADDRESS

    fun saveServerAddress(address: String) {
        preferences.edit().putString(SERVER_ADDRESS_KEY, address.trim()).apply()
    }

    fun isValidServerAddress(address: String): Boolean {
        val rawAddress = address.trim()
        if (rawAddress.startsWith("https://")) return false
        val candidate = rawAddress.removePrefix("http://")
        val parts = candidate.split(':')
        if (parts.size != 2 || parts[0].isBlank()) return false
        if (!parts[0].matches(Regex("[A-Za-z0-9.-]+"))) return false
        val port = parts[1].toIntOrNull()
        return port != null && port in 1..65535
    }

    fun isHealthy(): Boolean {
        val url = "${baseUrl()}/health"
        val request = Request.Builder().url(url).get().build()
        return healthClient.newCall(request).execute().use { it.code == 200 }
    }

    fun sendItem(item: QueuedItem): Boolean {
        val payload = JSONObject()
            .put("text", item.text)
            .put("non_skippable", item.non_skippable)
            .put("created_at", item.created_at)
            .toString()
            .toRequestBody(JSON_MEDIA_TYPE)
        val request = Request.Builder()
            .url("${baseUrl()}/items")
            .post(payload)
            .build()
        return sendClient.newCall(request).execute().use { response ->
            if (response.code != 200 && response.code != 201) {
                Log.w(TAG, "Desktop rejected queued item with HTTP ${response.code}")
                false
            } else {
                true
            }
        }
    }

    private fun baseUrl(): String {
        val address = getServerAddress().trim()
        val normalized = if (address.startsWith("http://") || address.startsWith("https://")) {
            address
        } else {
            "http://$address"
        }
        return normalized.trimEnd('/')
    }

    companion object {
        const val DEFAULT_SERVER_ADDRESS = "192.168.68.105:3000"
        private const val PREFERENCES_NAME = "taskdrop_settings"
        private const val SERVER_ADDRESS_KEY = "desktop_address"
        private const val TAG = "TaskDropSync"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
