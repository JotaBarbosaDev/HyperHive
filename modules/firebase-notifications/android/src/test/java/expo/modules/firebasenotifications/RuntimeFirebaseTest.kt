package expo.modules.firebasenotifications

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class RuntimeFirebaseTest {
  private fun config() = JSONObject()
    .put("project_info", JSONObject().put("project_id", "example-project").put("project_number", "123456"))
    .put("client", JSONArray().put(JSONObject()
      .put("client_info", JSONObject().put("mobilesdk_app_id", "1:123456:android:abcdef")
        .put("android_client_info", JSONObject().put("package_name", "com.anonymous.hyperhive")))
      .put("api_key", JSONArray().put(JSONObject().put("current_key", "AIza" + "a".repeat(35))))))

  @Test fun selectsOnlyMatchingPackageAndExtractsClientFields() {
    val source = config()
    source.getJSONArray("client").put(JSONObject(source.getJSONArray("client").getJSONObject(0).toString()).apply {
      getJSONObject("client_info").getJSONObject("android_client_info").put("package_name", "com.example.other")
    })
    val parsed = RuntimeFirebase.validate(source.toString(), "com.anonymous.hyperhive")
    assertEquals("example-project", parsed.getString("projectId"))
    assertEquals(4, parsed.length())
    assertFalse(parsed.has("client"))
  }

  @Test fun sanitizesMalformedConfiguration() {
    val error = assertThrows(IllegalArgumentException::class.java) { RuntimeFirebase.validate("{private_key:SECRET", "com.anonymous.hyperhive") }
    assertFalse(error.message.orEmpty().contains("SECRET"))
    assertThrows(IllegalArgumentException::class.java) { RuntimeFirebase.validate("{}", "com.anonymous.hyperhive") }
  }

  @Test fun rejectsDuplicateOrMissingPackage() {
    val source = config()
    source.getJSONArray("client").put(source.getJSONArray("client").getJSONObject(0))
    assertThrows(IllegalArgumentException::class.java) { RuntimeFirebase.validate(source.toString(), "com.anonymous.hyperhive") }
    assertThrows(IllegalArgumentException::class.java) { RuntimeFirebase.validate(config().toString(), "com.example.missing") }
  }

  @Test fun rejectsServerCredentialsOversizeAndMismatchedSender() {
    assertThrows(IllegalArgumentException::class.java) { RuntimeFirebase.validate(config().put("private_key", "redacted").toString(), "com.anonymous.hyperhive") }
    assertThrows(IllegalArgumentException::class.java) { RuntimeFirebase.validate(" ".repeat(65537), "com.anonymous.hyperhive") }
    val source = config()
    source.getJSONObject("project_info").put("project_number", "999")
    assertThrows(IllegalArgumentException::class.java) { RuntimeFirebase.validate(source.toString(), "com.anonymous.hyperhive") }
  }

  @Test fun exposesStableSeverityChannelsAndSafeMapping() {
    assertEquals(listOf("info", "warn", "error", "critical"), RuntimeFirebase.TEST_CHANNELS.keys.toList())
    assertEquals("hyperhive_test_critical", RuntimeFirebase.TEST_CHANNELS["critical"])
    assertNull(RuntimeFirebase.TEST_CHANNELS["urgent"])
    assertEquals("hyperhive_test_v2", RuntimeFirebase.channelForSeverity("urgent"))
    assertEquals("hyperhive_test_error", RuntimeFirebase.channelForSeverity("error"))
    assertEquals("hyperhive_test_v2", RuntimeFirebase.CHANNEL)
  }

  @Test fun channelDefaultsMatchTheSettingsDescriptions() {
    assertEquals(RuntimeFirebase.ChannelDefaults(android.app.NotificationManager.IMPORTANCE_LOW, false, false), RuntimeFirebase.TEST_CHANNEL_DEFAULTS["info"])
    assertEquals(RuntimeFirebase.ChannelDefaults(android.app.NotificationManager.IMPORTANCE_LOW, false, false), RuntimeFirebase.TEST_CHANNEL_DEFAULTS["warn"])
    assertEquals(RuntimeFirebase.ChannelDefaults(android.app.NotificationManager.IMPORTANCE_DEFAULT, true, true), RuntimeFirebase.TEST_CHANNEL_DEFAULTS["error"])
    assertEquals(RuntimeFirebase.ChannelDefaults(android.app.NotificationManager.IMPORTANCE_HIGH, true, true), RuntimeFirebase.TEST_CHANNEL_DEFAULTS["critical"])
  }
}
