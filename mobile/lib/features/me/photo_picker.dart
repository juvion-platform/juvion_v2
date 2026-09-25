import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:juvi/app/l10n/l10n.dart';
import 'package:juvi/core/http/api_failure.dart';
import 'package:juvi/core/repos/me_repository.dart';

/// Pick -> square crop -> compress to <=1280px JPEG -> upload. Online only.
Future<void> pickAndUploadPhoto(BuildContext context, WidgetRef ref) async {
  final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2048, maxHeight: 2048);
  if (picked == null) return;
  final cropped = await ImageCropper().cropImage(sourcePath: picked.path, aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1));
  if (cropped == null) return;
  final bytes = await FlutterImageCompress.compressWithFile(cropped.path, minWidth: 1280, minHeight: 1280, quality: 82);
  if (bytes == null) return;
  if (!context.mounted) return;
  final l = context.l10n;
  try {
    final repo = await ref.read(meRepositoryProvider.future);
    await repo.uploadPhoto(bytes, 'photo.jpg');
    ref.invalidate(meProvider);
  } on ApiFailure catch (f) {
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.isOffline ? l.photoUploadNeedsConnection : f.message)));
  }
}
