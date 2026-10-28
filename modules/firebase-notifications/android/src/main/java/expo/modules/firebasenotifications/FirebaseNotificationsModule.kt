package expo.modules.firebasenotifications

import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class FirebaseNotificationsModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "Android context unavailable." }
  private fun ready() {
    val status = status()
    check(status["enabled"] == true) { "Enable notifications first." }
    check(status["restartRequired"] == false) { "Restart the app before continuing." }
    check(status["permissionGranted"] == true && status["channelEnabled"] == true) { "Allow notifications in Android settings." }
  }
  private fun status(): Map<String, Any?> {
    val prefs = RuntimeFirebase.preferences(context)
    val saved = prefs.getString("configuration", null)?.let { JSONObject(it) }
    val app = FirebaseApp.getApps(context).firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }
    val manager = context.getSystemService(NotificationManager::class.java)
    return mapOf(
      "packageName" to context.packageName,
      "projectId" to saved?.getString("projectId"),
      "lastMessageId" to prefs.getString("lastMessageId", null),
      "lastReceivedAt" to prefs.getLong("lastReceivedAt", 0L).toDouble(),
      "enabled" to prefs.getBoolean("enabled", false),
      "restartRequired" to (app != null && saved != null && (app.options.applicationId != saved.getString("appId") || app.options.apiKey != saved.getString("apiKey") || app.options.projectId != saved.getString("projectId") || app.options.gcmSenderId != saved.getString("senderId"))),
      "permissionGranted" to (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED),
      "channelEnabled" to (manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(RuntimeFirebase.CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE))
    )
  }
  override fun definition() = ModuleDefinition {
    Name("FirebaseNotifications")
    Function("getStatus") { status() }
    Function("getConfiguration") {
      RuntimeFirebase.preferences(context).getString("configuration", null)?.let { raw ->
        val config = JSONObject(raw)
        listOf("projectId", "appId", "apiKey", "senderId").associateWith { config.getString(it) }
      }
    }
    Function("saveConfiguration") { raw: String ->
      check(!RuntimeFirebase.preferences(context).getBoolean("enabled", false)) { "Disable notifications before importing configuration." }
      val config = RuntimeFirebase.validate(raw, context.packageName)
      check(RuntimeFirebase.preferences(context).edit().putString("configuration", config.toString()).commit()) { "Could not save configuration." }
      status()
    }
    Function("activate") {
      val state = status()
      check(state["restartRequired"] == false) { "Restart the app before enabling notifications." }
      check(state["permissionGranted"] == true && state["channelEnabled"] == true) { "Allow notifications in Android settings." }
      check(RuntimeFirebase.initialize(context) != null) { "Import Firebase configuration first." }
      check(RuntimeFirebase.preferences(context).edit().putBoolean("enabled", true).commit()) { "Could not save activation." }
      FirebaseMessaging.getInstance().isAutoInitEnabled = true
      status()
    }
    AsyncFunction("getToken") { promise: Promise ->
      ready()
      RuntimeFirebase.initialize(context)
      FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
        if (task.isSuccessful) promise.resolve(task.result)
        else promise.reject("TOKEN_UNAVAILABLE", "Could not obtain a Firebase token. Check network and client configuration.", null)
      }
    }
    AsyncFunction("disable") { promise: Promise ->
      check(RuntimeFirebase.preferences(context).edit().putBoolean("enabled", false).commit()) { "Could not save disabled state." }
      if (FirebaseApp.getApps(context).none { it.name == FirebaseApp.DEFAULT_APP_NAME }) {
        promise.resolve(status())
      } else {
        val messaging = FirebaseMessaging.getInstance()
        messaging.isAutoInitEnabled = false
        messaging.deleteToken().addOnCompleteListener { task ->
          if (task.isSuccessful) promise.resolve(status())
          else promise.reject("TOKEN_DELETE_FAILED", "Notifications disabled locally; token deletion failed. Retry while online.", null)
        }
      }
    }
  }
}
