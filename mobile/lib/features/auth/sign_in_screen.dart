import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/forgot_password_sheet.dart';
import 'package:juvi/features/auth/institution_code_field.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  static const _rememberKey = 'juvi.institution_code';
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  InstitutionIdentity? _institution;

  /// The institution code that resolved; remembered for the next launch (S01 AC 2).
  String? _resolvedCode;
  String? _rememberedCode;
  String? _error;
  bool _busy = false;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    unawaited(SharedPreferences.getInstance().then((p) {
      if (mounted) setState(() => _rememberedCode = p.getString(_rememberKey) ?? '');
    }));
  }

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _canSubmit => _institution != null && !_institution!.paused && _identifier.text.trim().isNotEmpty && _password.text.isNotEmpty && !_busy;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(sessionControllerProvider.notifier).signIn(collegeId: _institution!.collegeId, identifier: _identifier.text.trim(), password: _password.text);
      await (await SharedPreferences.getInstance()).setString(_rememberKey, _resolvedCode ?? '');
    } on ApiFailure catch (f) {
      if (!mounted) return;
      final l = context.l10n;
      setState(() => _error = switch (f.code) {
            ApiErrorCode.invalidCredentials => l.invalidCredentials,
            ApiErrorCode.cooldown => l.cooldownMessage(((f.retryAfterSeconds ?? 60) / 60).ceil()),
            ApiErrorCode.offline => l.signInNeedsConnection,
            ApiErrorCode.institutionPaused => (f.detail['message'] as String?) ?? f.message,
            _ => f.message,
          });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final session = ref.watch(sessionControllerProvider);
    final reason = session is SignedOut ? session.reason : null;
    final reasonText = switch (reason) {
      'signed_out_elsewhere' => l.signedOutElsewhere,
      'password_changed' => l.signedOutPasswordChanged,
      null || 'restore' => null,
      _ => l.signedOutGeneric,
    };
    if (_rememberedCode == null) return const Scaffold(body: SizedBox.shrink()); // waiting for prefs, one frame

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 32),
            Text(l.appName, style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(l.signInTitle, style: Theme.of(context).textTheme.titleMedium),
            if (reasonText != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(reasonText, style: TextStyle(color: Theme.of(context).colorScheme.tertiary))),
            const SizedBox(height: 28),
            InstitutionCodeField(
              initialCode: _rememberedCode!.isEmpty ? null : _rememberedCode,
              onResolved: (id, code) => setState(() {
                _institution = id;
                _resolvedCode = id != null ? code : null;
              }),
            ),
            if (_institution?.paused == true) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_institution!.pausedMessage ?? l.pausedTitle)),
            const SizedBox(height: 16),
            TextField(controller: _identifier, autocorrect: false, decoration: InputDecoration(labelText: l.identifierLabel), onChanged: (_) => setState(() {})),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: _obscure,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: l.passwordLabel,
                suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => _obscure = !_obscure)),
              ),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) {
                if (_canSubmit) unawaited(_submit());
              },
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _canSubmit ? _submit : null,
              child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l.signInButton),
            ),
            const SizedBox(height: 16),
            Text(l.firstTimeHint, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
            TextButton(onPressed: () => unawaited(showForgotPasswordSheet(context)), child: Text(l.forgotPassword)),
          ],
        ),
      ),
    );
  }
}
