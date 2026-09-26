import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/auth_repository.dart';

/// Voluntary in-app password change (unlike SetPasswordScreen's forced onboarding
/// flow): shares its form fields and password-strength hint, but has a back button
/// and pops on success instead of updating the session.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});
  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  String? _error;
  String? _lengthError;
  bool _busy = false;
  bool _obscure = true;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  String _strength(String v, AppLocalizations l) => v.length >= 16
      ? l.passwordStrengthStrong
      : v.length >= 12
          ? l.passwordStrengthGood
          : v.length >= 8
              ? l.passwordStrengthOk
              : l.passwordStrengthTooShort;

  Future<void> _submit() async {
    final l = context.l10n;
    setState(() {
      _error = null;
      _lengthError = _next.text.length < 8 ? l.passwordTooShort : null;
    });
    if (_lengthError != null) return;
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).changePassword(_current.text, _next.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l.changePasswordSuccess)));
      context.pop();
    } on ApiFailure catch (f) {
      if (!mounted) return;
      setState(() => _error = f.isOffline ? l.changePasswordNeedsConnection : f.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.changePasswordTitle)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(controller: _current, obscureText: true, autocorrect: false, decoration: InputDecoration(labelText: l.currentPasswordLabel)),
          const SizedBox(height: 12),
          TextField(
            controller: _next,
            obscureText: _obscure,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: l.newPasswordLabel,
              errorText: _lengthError,
              helperText: _next.text.isEmpty ? null : _strength(_next.text, l),
              suffixIcon: IconButton(
                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                tooltip: _obscure ? l.showPassword : l.hidePassword,
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            onChanged: (_) => setState(() => _lengthError = null),
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          const SizedBox(height: 20),
          FilledButton(onPressed: _busy ? null : _submit, child: Text(l.savePassword)),
        ],
      ),
    );
  }
}
