package `in`.juvion.juvi

import android.content.Intent
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // S12 and S14 "Open settings" (lib/core/push/notification_permission.dart): this
        // app's page in the system notification settings.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.juvion.juvi/settings").setMethodCallHandler { call, result ->
            if (call.method == "openNotificationSettings") {
                startActivity(
                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                result.success(null)
            } else {
                result.notImplemented()
            }
        }
    }
}
