package expo.modules.firebasenotifications

import android.app.Notification
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class TestMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    if (!RuntimeFirebase.preferences(this).getBoolean("enabled", false)) return
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return
    val content = message.notification ?: return
    RuntimeFirebase.createChannel(this)
    val manager = getSystemService(NotificationManager::class.java)
    if (!manager.areNotificationsEnabled()) return
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(RuntimeFirebase.CHANNEL)?.importance == NotificationManager.IMPORTANCE_NONE) return
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, RuntimeFirebase.CHANNEL) else Notification.Builder(this)
    val notification = builder
      .setSmallIcon(R.drawable.hyperhive_notification)
      .setPriority(Notification.PRIORITY_HIGH)
      .setContentTitle(content.title).setContentText(content.body).setAutoCancel(true).build()
    manager.notify(message.messageId ?: "hyperhive", 1, notification)
    RuntimeFirebase.preferences(this).edit().putString("lastMessageId", message.messageId)
      .putLong("lastReceivedAt", System.currentTimeMillis()).apply()
  }
}
