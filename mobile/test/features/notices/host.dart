import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/app/theme.dart';

/// A localized, themed host for the notices widgets. `accessibleNavigation` stands in
/// for a running screen reader; `textScale` exercises large text.
Widget noticeHost(
  Widget child, {
  List<Override> overrides = const [],
  bool accessibleNavigation = false,
  double textScale = 1,
  Brightness brightness = Brightness.light,
  bool scroll = true,
}) =>
    ProviderScope(
      retry: (_, _) => null,
      overrides: overrides,
      child: MaterialApp(
        theme: buildTheme(brightness: brightness),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, app) => MediaQuery(
          data: MediaQuery.of(context).copyWith(accessibleNavigation: accessibleNavigation, textScaler: TextScaler.linear(textScale)),
          child: app!,
        ),
        home: Scaffold(body: scroll ? ListView(padding: const EdgeInsets.all(16), children: [child]) : child),
      ),
    );
