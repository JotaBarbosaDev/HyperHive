package expo.modules.firebasenotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import org.json.JSONException

internal object RuntimeFirebase {
  const val CHANNEL = "hyperhive_test_v2"
  fun preferences(context: Context) = context.getSharedPreferences("hyperhive_firebase", Context.MODE_PRIVATE)

  fun validate(raw: String, packageName: String): JSONObject = try {
    require(raw.toByteArray(Charsets.UTF_8).size <= 65536) { "Configuration exceeds 64 KiB." }
    val root = JSONObject(raw)
    require(!root.has("private_key") && !root.has("type")) { "Import Android client configuration, never server credentials." }
    val project = root.getJSONObject("project_info")
    val clients = root.getJSONArray("client")
    val matches = (0 until clients.length()).map { clients.getJSONObject(it) }.filter {
      it.getJSONObject("client_info").optJSONObject("android_client_info")?.optString("package_name") == packageName
    }
    require(matches.size == 1) { "Configuration must contain exactly one client for $packageName." }
    val client = matches.single()
    val result = JSONObject()
      .put("projectId", project.getString("project_id"))
      .put("senderId", project.getString("project_number"))
      .put("appId", client.getJSONObject("client_info").getString("mobilesdk_app_id"))
      .put("apiKey", client.getJSONArray("api_key").getJSONObject(0).getString("current_key"))
    require(Regex("[a-z][a-z0-9-]{4,28}[a-z0-9]").matches(result.getString("projectId"))) { "Invalid project ID." }
    require(Regex("[0-9]+").matches(result.getString("senderId"))) { "Invalid sender ID." }
    require(result.getString("appId").startsWith("1:${result.getString("senderId")}:android:")) { "Invalid Android app ID." }
    require(Regex("AIza[\\w-]{35}").matches(result.getString("apiKey"))) { "Invalid API key." }
    result
  } catch (_: JSONException) {
    throw IllegalArgumentException("Invalid Android Firebase client configuration. Import google-services.json for the installed package.")
  }

  @Synchronized fun initialize(context: Context): FirebaseApp? {
    val saved = preferences(context).getString("configuration", null) ?: return null
    val config = JSONObject(saved)
    val app = FirebaseApp.getApps(context).firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }
      ?: FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
        .setApplicationId(config.getString("appId"))
        .setProjectId(config.getString("projectId"))
        .setApiKey(config.getString("apiKey"))
        .setGcmSenderId(config.getString("senderId")).build())
    FirebaseMessaging.getInstance().isAutoInitEnabled = preferences(context).getBoolean("enabled", false)
    return app
  }

  fun createChannel(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val oldChannelBlocked = manager.getNotificationChannel("hyperhive_test")?.importance == NotificationManager.IMPORTANCE_NONE
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "HyperHive test notifications",
      if (oldChannelBlocked) NotificationManager.IMPORTANCE_NONE else NotificationManager.IMPORTANCE_HIGH))
  }
}
