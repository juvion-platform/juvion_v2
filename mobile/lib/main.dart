import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:juvi/app/app.dart';
import 'package:juvi/core/http/api_providers.dart';
import 'package:juvi/core/session/session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en_IN');
  // R42: disable Riverpod 3's automatic provider retry; the app owns retry UX.
  final container = ProviderContainer(retry: (_, _) => null);
  // R52: the Dio built for the first request must carry the real app version,
  // not the "0.0.0" fallback, so this resolves before restore() (which can make
  // a network call on a cache miss) and before runApp.
  await container.read(appVersionProvider.future);
  // Cached state renders before any network round-trip (spec §11). restore() never
  // throws (unreadable storage or cache ends signed out), so runApp is always reached.
  await container.read(sessionControllerProvider.notifier).restore();
  runApp(UncontrolledProviderScope(container: container, child: const JuviApp()));
}
