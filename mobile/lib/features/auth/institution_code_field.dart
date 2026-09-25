import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/models/models.dart';
import 'package:juvi/core/repos/auth_repository.dart';

/// Institution code with a debounced lookup. Unknown and disabled codes look identical (spec §8).
class InstitutionCodeField extends ConsumerStatefulWidget {
  const InstitutionCodeField({required this.onResolved, this.initialCode, super.key});

  /// Called with the identity (or null while unresolved) and the code that was typed.
  final void Function(InstitutionIdentity? identity, String code) onResolved;
  final String? initialCode;

  @override
  ConsumerState<InstitutionCodeField> createState() => _InstitutionCodeFieldState();
}

class _InstitutionCodeFieldState extends ConsumerState<InstitutionCodeField> {
  late final _ctrl = TextEditingController(text: widget.initialCode ?? '');
  Timer? _debounce;
  InstitutionIdentity? _identity;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if ((widget.initialCode ?? '').isNotEmpty) unawaited(_lookup(widget.initialCode!));
  }

  void _changed(String v) {
    _debounce?.cancel();
    setState(() {
      _identity = null;
      _error = null;
    });
    widget.onResolved(null, v.trim().toUpperCase());
    if (v.trim().length < 2) return;
    _debounce = Timer(const Duration(milliseconds: 500), () => unawaited(_lookup(v)));
  }

  /// Whether [code] is still what the field shows — a lookup started for an earlier
  /// value must not overwrite a later one that's since been typed (or already resolved).
  bool _isCurrent(String code) => code.trim().toUpperCase() == _ctrl.text.trim().toUpperCase();

  Future<void> _lookup(String code) async {
    setState(() => _busy = true);
    try {
      final id = await ref.read(authRepositoryProvider).lookupInstitution(code);
      if (!mounted || !_isCurrent(code)) return;
      setState(() {
        _identity = id;
        _error = null;
      });
      widget.onResolved(id, code.trim().toUpperCase());
    } on ApiFailure catch (f) {
      if (!mounted || !_isCurrent(code)) return;
      setState(() => _error = f.isOffline ? context.l10n.signInNeedsConnection : context.l10n.institutionCodeNotFound);
    } finally {
      if (mounted && _isCurrent(code)) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _ctrl,
          textCapitalization: TextCapitalization.characters,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: context.l10n.institutionCodeLabel,
            errorText: _error,
            suffixIcon: _busy ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))) : null,
          ),
          onChanged: _changed,
        ),
        if (_identity != null)
          // `container: true` keeps this its own semantics node — without it, the framework
          // merges this text into the institution-code field's label node, which both confuses
          // screen readers (announcing "Institution code, JIT College" as one blob) and makes
          // the field's own label unreachable by `find.bySemanticsLabel` once an identity resolves.
          Semantics(
            container: true,
            child: Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(
                children: [
                  if (_identity!.logoUrl != null)
                    ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(_identity!.logoUrl!, width: 40, height: 40, errorBuilder: (_, _, _) => const SizedBox.shrink()))
                  else
                    Icon(Icons.account_balance_outlined, color: scheme.primary),
                  const SizedBox(width: 12),
                  Expanded(child: Text(_identity!.name, style: Theme.of(context).textTheme.titleMedium)),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
