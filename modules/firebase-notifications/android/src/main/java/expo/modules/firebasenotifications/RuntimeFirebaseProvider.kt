package expo.modules.firebasenotifications

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

// A provider restores the default app before Messaging can run, even without a React activity.
class RuntimeFirebaseProvider : ContentProvider() {
  override fun onCreate(): Boolean {
    val appContext = context ?: return false
    RuntimeFirebase.createChannel(appContext)
    try { RuntimeFirebase.initialize(appContext) } catch (_: Exception) {
      RuntimeFirebase.preferences(appContext).edit().putBoolean("enabled", false).commit()
    }
    return true
  }
  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
