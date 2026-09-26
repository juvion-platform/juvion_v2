import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/shared/format.dart';

class AsOfLine extends StatelessWidget {
  const AsOfLine(this.asOf, {super.key});
  final DateTime asOf;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Text(context.l10n.asOf(hhmm(asOf)), style: Theme.of(context).textTheme.labelMedium),
      );
}
