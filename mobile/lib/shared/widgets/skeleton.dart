import 'package:flutter/material.dart';

class Skeleton extends StatelessWidget {
  const Skeleton({this.height = 16, this.width = double.infinity, this.radius = 6, super.key});
  final double height;
  final double width;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(
        height: height, width: width,
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(radius)),
      );
}

class SkeletonList extends StatelessWidget {
  const SkeletonList({this.count = 4, super.key});
  final int count;
  @override
  Widget build(BuildContext context) => Column(
        children: List.generate(count, (_) => const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(children: [Skeleton(height: 40, width: 40, radius: 20), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton(width: 180), SizedBox(height: 6), Skeleton(height: 12, width: 120)]))]),
        )),
      );
}
