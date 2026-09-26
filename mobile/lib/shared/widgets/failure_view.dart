import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';

class FailureView extends StatelessWidget {
  const FailureView(this.failure, {this.onRetry, super.key});
  final ApiFailure failure;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(failure.isOffline ? Icons.cloud_off_outlined : Icons.error_outline, size: 36, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(height: 10),
          Text(failure.isOffline ? context.l10n.offlineBanner : failure.message, textAlign: TextAlign.center),
          if (onRetry != null) ...[const SizedBox(height: 12), OutlinedButton(onPressed: onRetry, child: Text(context.l10n.retry))],
        ]),
      );
}
