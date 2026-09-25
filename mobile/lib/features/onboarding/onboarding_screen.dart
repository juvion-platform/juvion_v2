import 'package:flutter/material.dart';

/// Placeholder — replaced by the onboarding task.
class OnboardingScreen extends StatelessWidget {
  const OnboardingScreen({required this.step, super.key});
  final int step;
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text('/onboarding/$step')));
}
