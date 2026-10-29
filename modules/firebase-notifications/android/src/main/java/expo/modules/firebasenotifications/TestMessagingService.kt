package expo.modules.firebasenotifications

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.pm.PackageManager
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class TestMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    if (!RuntimeFirebase.preferences(this).getBoolean("enabled", false)) return
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return
    val content = message.notification ?: return
    RuntimeFirebase.createChannels(this)
    val manager = getSystemService(NotificationManager::class.java)
    if (!manager.areNotificationsEnabled()) return
    val severity = message.data["severity"]?.takeIf { it in RuntimeFirebase.TEST_CHANNELS }
    val channel = RuntimeFirebase.channelForSeverity(severity)
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(channel)?.importance == NotificationManager.IMPORTANCE_NONE) return
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channel) else Notification.Builder(this)
    val priority = when (severity) {
      "info", "warn" -> Notification.PRIORITY_LOW
      "error" -> Notification.PRIORITY_DEFAULT
      else -> Notification.PRIORITY_HIGH
    }
    builder.setSmallIcon(R.drawable.hyperhive_notification).setPriority(priority)
    if (Build.VERSION.SDK_INT < 26) {
      if (severity == "info" || severity == "warn") builder.setDefaults(0).setSound(null).setVibrate(null)
      else if (severity == "critical") builder.setDefaults(Notification.DEFAULT_VIBRATE).setSound(RuntimeFirebase.criticalSound(this))
      else builder.setDefaults(Notification.DEFAULT_SOUND or Notification.DEFAULT_VIBRATE)
    }
    val notification = builder
      .setContentTitle(content.title).setContentText(content.body).setContentIntent(
        packageManager.getLaunchIntentForPackage(packageName)?.let { intent ->
          PendingIntent.getActivity(this, message.messageId?.hashCode() ?: 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
      ).setAutoCancel(true).build()
    manager.notify(message.messageId ?: "hyperhive", 1, notification)
    RuntimeFirebase.preferences(this).edit().putString("lastMessageId", message.messageId)
      .putLong("lastReceivedAt", System.currentTimeMillis()).apply()
  }
}
