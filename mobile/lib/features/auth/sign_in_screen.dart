import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/session/session_controller.dart';
import 'package:juvi/core/session/session_state.dart';
import 'package:juvi/features/auth/forgot_password_sheet.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _juviId = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;
  bool _obscure = true;

  @override
  void dispose() {
    _juviId.dispose();
    _password.dispose();
    super.dispose();
  }

  // Nothing gates the button but the two fields: the Juvi ID is the only key, and the college
  // is resolved by the server after the password is checked (spec §6). A paused college can no
  // longer be known before credentials, so it reaches this screen only as the 503's message.
  bool get _canSubmit => _juviId.text.trim().isNotEmpty && _password.text.isNotEmpty && !_busy;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Trimmed, and otherwise sent exactly as typed: normalisation (case, separators) belongs
      // to the server, the only side that can be trusted with it (R-N).
      await ref.read(sessionControllerProvider.notifier).signIn(juviId: _juviId.text.trim(), password: _password.text);
    } on ApiFailure catch (f) {
      if (!mounted) return;
      final l = context.l10n;
      setState(() => _error = switch (f.code) {
            ApiErrorCode.invalidCredentials => l.invalidCredentials,
            // R56: floor at 1 minute so a 0 or missing retryAfterSeconds never reads "0 minutes".
            ApiErrorCode.cooldown => l.cooldownMessage(math.max(1, ((f.retryAfterSeconds ?? 60) / 60).ceil())),
            ApiErrorCode.offline => l.signInNeedsConnection,
            // R56: ApiFailure.fromDio strips `message` out of `detail` into the top-level field.
            ApiErrorCode.institutionPaused => f.message,
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
            TextField(controller: _juviId, autocorrect: false, decoration: InputDecoration(labelText: l.juviIdLabel), onChanged: (_) => setState(() {})),
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
            Text(l.juviIdFirstTimeHint, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
            TextButton(onPressed: () => unawaited(showForgotPasswordSheet(context)), child: Text(l.forgotPassword)),
          ],
        ),
      ),
    );
  }
}
