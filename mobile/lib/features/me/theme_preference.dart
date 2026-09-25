import 'dart:async';

import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'theme_preference.g.dart';

@Riverpod(keepAlive: true)
class ThemePreference extends _$ThemePreference {
  static const _key = 'juvi.theme_mode';
  @override
  ThemeMode build() {
    unawaited(SharedPreferences.getInstance().then((p) {
      // R55: the notifier may have been disposed by the time this async gap resolves.
      if (!ref.mounted) return;
      final v = p.getString(_key);
      if (v != null) state = ThemeMode.values.byName(v);
    }));
    return ThemeMode.system;
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, mode.name);
  }
}
