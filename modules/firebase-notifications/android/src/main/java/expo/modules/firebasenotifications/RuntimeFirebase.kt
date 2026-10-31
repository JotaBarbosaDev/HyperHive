package expo.modules.firebasenotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import org.json.JSONException

internal object RuntimeFirebase {
  data class ChannelDefaults(val importance: Int, val sound: Boolean, val vibration: Boolean)

  const val CHANNEL = "hyperhive_test_v2"
  val TEST_CHANNELS = listOf("info", "warn", "error", "critical").associateWith { "hyperhive_test_$it" }
  val TEST_CHANNEL_DEFAULTS = mapOf(
    "info" to ChannelDefaults(NotificationManager.IMPORTANCE_LOW, false, false),
    "warn" to ChannelDefaults(NotificationManager.IMPORTANCE_LOW, false, false),
    "error" to ChannelDefaults(NotificationManager.IMPORTANCE_DEFAULT, true, true),
    "critical" to ChannelDefaults(NotificationManager.IMPORTANCE_HIGH, true, true)
  )
  fun channelForSeverity(severity: String?) = severity?.let { TEST_CHANNELS[it] } ?: CHANNEL
  fun criticalSound(context: Context): Uri = Uri.parse("android.resource://${context.packageName}/raw/${context.resources.getResourceEntryName(R.raw.hyperhive_critical)}")
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

  fun createChannels(context: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val oldChannelBlocked = manager.getNotificationChannel("hyperhive_test")?.importance == NotificationManager.IMPORTANCE_NONE
    val legacyChannelBlocked = oldChannelBlocked || manager.getNotificationChannel(CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "HyperHive test notifications",
      if (oldChannelBlocked) NotificationManager.IMPORTANCE_NONE else NotificationManager.IMPORTANCE_HIGH))
    TEST_CHANNELS.forEach { (severity, id) ->
      val defaults = TEST_CHANNEL_DEFAULTS.getValue(severity)
      val label = if (severity == "warn") "warning" else severity
      val channel = NotificationChannel(id, "HyperHive $label", if (legacyChannelBlocked) NotificationManager.IMPORTANCE_NONE else defaults.importance)
      if (!defaults.sound) channel.setSound(null, null)
      else if (severity == "critical") channel.setSound(criticalSound(context), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
      channel.enableVibration(defaults.vibration)
      manager.createNotificationChannel(channel)
    }
  }
}
