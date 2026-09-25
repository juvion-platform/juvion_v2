import 'package:flutter/material.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/models/models.dart';

/// Identity summary at the top of the Me screen (S12): photo, name, role line.
class IdentityCard extends StatelessWidget {
  const IdentityCard(this.me, {this.onChangePhoto, super.key});
  final Me me;
  final VoidCallback? onChangePhoto;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final t = Theme.of(context).textTheme;
    final s = me.student;
    final f = me.faculty;
    final lines = <String>[
      if (s != null) ...[
        s.rollNumber ?? '',
        [s.programme, s.branch].whereType<String>().join(' · '),
        [s.batch, if (s.section != null) l.studentSectionLabel(s.section!)].whereType<String>().join(' · '),
        s.department ?? '',
        if (s.hostel != null) s.hostel!,
      ],
      if (f != null) ...[f.employeeCode, f.designation, f.department ?? '', if (f.isHod) l.facultyHod],
      me.institution.name,
    ].where((line) => line.isNotEmpty).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              button: onChangePhoto != null,
              label: l.meChangePhoto,
              child: GestureDetector(
                onTap: onChangePhoto,
                child: CircleAvatar(
                  radius: 32,
                  backgroundImage: me.person.photoUrl != null ? NetworkImage(me.person.photoUrl!) : null,
                  child: me.person.photoUrl == null ? Text(me.person.firstName.characters.first.toUpperCase(), style: t.titleLarge) : null,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(me.person.name, style: t.titleLarge),
                  const SizedBox(height: 4),
                  for (final line in lines) Text(line, style: t.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
