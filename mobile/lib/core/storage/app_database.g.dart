// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $KvCacheTable extends KvCache with TableInfo<$KvCacheTable, KvCacheData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $KvCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jsonMeta = const VerificationMeta('json');
  @override
  late final GeneratedColumn<String> json = GeneratedColumn<String>(
    'json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _asOfMeta = const VerificationMeta('asOf');
  @override
  late final GeneratedColumn<DateTime> asOf = GeneratedColumn<DateTime>(
    'as_of',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [key, json, asOf];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'kv_cache';
  @override
  VerificationContext validateIntegrity(
    Insertable<KvCacheData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('json')) {
      context.handle(
        _jsonMeta,
        json.isAcceptableOrUnknown(data['json']!, _jsonMeta),
      );
    } else if (isInserting) {
      context.missing(_jsonMeta);
    }
    if (data.containsKey('as_of')) {
      context.handle(
        _asOfMeta,
        asOf.isAcceptableOrUnknown(data['as_of']!, _asOfMeta),
      );
    } else if (isInserting) {
      context.missing(_asOfMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  KvCacheData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return KvCacheData(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      json: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}json'],
      )!,
      asOf: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}as_of'],
      )!,
    );
  }

  @override
  $KvCacheTable createAlias(String alias) {
    return $KvCacheTable(attachedDatabase, alias);
  }
}

class KvCacheData extends DataClass implements Insertable<KvCacheData> {
  final String key;
  final String json;
  final DateTime asOf;
  const KvCacheData({
    required this.key,
    required this.json,
    required this.asOf,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['json'] = Variable<String>(json);
    map['as_of'] = Variable<DateTime>(asOf);
    return map;
  }

  KvCacheCompanion toCompanion(bool nullToAbsent) {
    return KvCacheCompanion(
      key: Value(key),
      json: Value(json),
      asOf: Value(asOf),
    );
  }

  factory KvCacheData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return KvCacheData(
      key: serializer.fromJson<String>(json['key']),
      json: serializer.fromJson<String>(json['json']),
      asOf: serializer.fromJson<DateTime>(json['asOf']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'json': serializer.toJson<String>(json),
      'asOf': serializer.toJson<DateTime>(asOf),
    };
  }

  KvCacheData copyWith({String? key, String? json, DateTime? asOf}) =>
      KvCacheData(
        key: key ?? this.key,
        json: json ?? this.json,
        asOf: asOf ?? this.asOf,
      );
  KvCacheData copyWithCompanion(KvCacheCompanion data) {
    return KvCacheData(
      key: data.key.present ? data.key.value : this.key,
      json: data.json.present ? data.json.value : this.json,
      asOf: data.asOf.present ? data.asOf.value : this.asOf,
    );
  }

  @override
  String toString() {
    return (StringBuffer('KvCacheData(')
          ..write('key: $key, ')
          ..write('json: $json, ')
          ..write('asOf: $asOf')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, json, asOf);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is KvCacheData &&
          other.key == this.key &&
          other.json == this.json &&
          other.asOf == this.asOf);
}

class KvCacheCompanion extends UpdateCompanion<KvCacheData> {
  final Value<String> key;
  final Value<String> json;
  final Value<DateTime> asOf;
  final Value<int> rowid;
  const KvCacheCompanion({
    this.key = const Value.absent(),
    this.json = const Value.absent(),
    this.asOf = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  KvCacheCompanion.insert({
    required String key,
    required String json,
    required DateTime asOf,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       json = Value(json),
       asOf = Value(asOf);
  static Insertable<KvCacheData> custom({
    Expression<String>? key,
    Expression<String>? json,
    Expression<DateTime>? asOf,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (json != null) 'json': json,
      if (asOf != null) 'as_of': asOf,
      if (rowid != null) 'rowid': rowid,
    });
  }

  KvCacheCompanion copyWith({
    Value<String>? key,
    Value<String>? json,
    Value<DateTime>? asOf,
    Value<int>? rowid,
  }) {
    return KvCacheCompanion(
      key: key ?? this.key,
      json: json ?? this.json,
      asOf: asOf ?? this.asOf,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (json.present) {
      map['json'] = Variable<String>(json.value);
    }
    if (asOf.present) {
      map['as_of'] = Variable<DateTime>(asOf.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('KvCacheCompanion(')
          ..write('key: $key, ')
          ..write('json: $json, ')
          ..write('asOf: $asOf, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PendingActionRowsTable extends PendingActionRows
    with TableInfo<$PendingActionRowsTable, PendingActionRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PendingActionRowsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    type,
    payload,
    createdAt,
    attempts,
    lastError,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pending_actions';
  @override
  VerificationContext validateIntegrity(
    Insertable<PendingActionRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PendingActionRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PendingActionRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
    );
  }

  @override
  $PendingActionRowsTable createAlias(String alias) {
    return $PendingActionRowsTable(attachedDatabase, alias);
  }
}

class PendingActionRow extends DataClass
    implements Insertable<PendingActionRow> {
  final String id;
  final String type;
  final String payload;
  final DateTime createdAt;
  final int attempts;
  final String? lastError;
  const PendingActionRow({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    required this.attempts,
    this.lastError,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['type'] = Variable<String>(type);
    map['payload'] = Variable<String>(payload);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    return map;
  }

  PendingActionRowsCompanion toCompanion(bool nullToAbsent) {
    return PendingActionRowsCompanion(
      id: Value(id),
      type: Value(type),
      payload: Value(payload),
      createdAt: Value(createdAt),
      attempts: Value(attempts),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
    );
  }

  factory PendingActionRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PendingActionRow(
      id: serializer.fromJson<String>(json['id']),
      type: serializer.fromJson<String>(json['type']),
      payload: serializer.fromJson<String>(json['payload']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      attempts: serializer.fromJson<int>(json['attempts']),
      lastError: serializer.fromJson<String?>(json['lastError']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'type': serializer.toJson<String>(type),
      'payload': serializer.toJson<String>(payload),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'attempts': serializer.toJson<int>(attempts),
      'lastError': serializer.toJson<String?>(lastError),
    };
  }

  PendingActionRow copyWith({
    String? id,
    String? type,
    String? payload,
    DateTime? createdAt,
    int? attempts,
    Value<String?> lastError = const Value.absent(),
  }) => PendingActionRow(
    id: id ?? this.id,
    type: type ?? this.type,
    payload: payload ?? this.payload,
    createdAt: createdAt ?? this.createdAt,
    attempts: attempts ?? this.attempts,
    lastError: lastError.present ? lastError.value : this.lastError,
  );
  PendingActionRow copyWithCompanion(PendingActionRowsCompanion data) {
    return PendingActionRow(
      id: data.id.present ? data.id.value : this.id,
      type: data.type.present ? data.type.value : this.type,
      payload: data.payload.present ? data.payload.value : this.payload,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PendingActionRow(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('payload: $payload, ')
          ..write('createdAt: $createdAt, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, type, payload, createdAt, attempts, lastError);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PendingActionRow &&
          other.id == this.id &&
          other.type == this.type &&
          other.payload == this.payload &&
          other.createdAt == this.createdAt &&
          other.attempts == this.attempts &&
          other.lastError == this.lastError);
}

class PendingActionRowsCompanion extends UpdateCompanion<PendingActionRow> {
  final Value<String> id;
  final Value<String> type;
  final Value<String> payload;
  final Value<DateTime> createdAt;
  final Value<int> attempts;
  final Value<String?> lastError;
  final Value<int> rowid;
  const PendingActionRowsCompanion({
    this.id = const Value.absent(),
    this.type = const Value.absent(),
    this.payload = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PendingActionRowsCompanion.insert({
    required String id,
    required String type,
    required String payload,
    required DateTime createdAt,
    this.attempts = const Value.absent(),
    this.lastError = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       type = Value(type),
       payload = Value(payload),
       createdAt = Value(createdAt);
  static Insertable<PendingActionRow> custom({
    Expression<String>? id,
    Expression<String>? type,
    Expression<String>? payload,
    Expression<DateTime>? createdAt,
    Expression<int>? attempts,
    Expression<String>? lastError,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (type != null) 'type': type,
      if (payload != null) 'payload': payload,
      if (createdAt != null) 'created_at': createdAt,
      if (attempts != null) 'attempts': attempts,
      if (lastError != null) 'last_error': lastError,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PendingActionRowsCompanion copyWith({
    Value<String>? id,
    Value<String>? type,
    Value<String>? payload,
    Value<DateTime>? createdAt,
    Value<int>? attempts,
    Value<String?>? lastError,
    Value<int>? rowid,
  }) {
    return PendingActionRowsCompanion(
      id: id ?? this.id,
      type: type ?? this.type,
      payload: payload ?? this.payload,
      createdAt: createdAt ?? this.createdAt,
      attempts: attempts ?? this.attempts,
      lastError: lastError ?? this.lastError,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PendingActionRowsCompanion(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('payload: $payload, ')
          ..write('createdAt: $createdAt, ')
          ..write('attempts: $attempts, ')
          ..write('lastError: $lastError, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $AnalyticsEventsTable extends AnalyticsEvents
    with TableInfo<$AnalyticsEventsTable, AnalyticsEventRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AnalyticsEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _atMeta = const VerificationMeta('at');
  @override
  late final GeneratedColumn<DateTime> at = GeneratedColumn<DateTime>(
    'at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _propsMeta = const VerificationMeta('props');
  @override
  late final GeneratedColumn<String> props = GeneratedColumn<String>(
    'props',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [id, name, at, props];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'analytics_events';
  @override
  VerificationContext validateIntegrity(
    Insertable<AnalyticsEventRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('at')) {
      context.handle(_atMeta, at.isAcceptableOrUnknown(data['at']!, _atMeta));
    } else if (isInserting) {
      context.missing(_atMeta);
    }
    if (data.containsKey('props')) {
      context.handle(
        _propsMeta,
        props.isAcceptableOrUnknown(data['props']!, _propsMeta),
      );
    } else if (isInserting) {
      context.missing(_propsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  AnalyticsEventRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return AnalyticsEventRow(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      at: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}at'],
      )!,
      props: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}props'],
      )!,
    );
  }

  @override
  $AnalyticsEventsTable createAlias(String alias) {
    return $AnalyticsEventsTable(attachedDatabase, alias);
  }
}

class AnalyticsEventRow extends DataClass
    implements Insertable<AnalyticsEventRow> {
  final int id;
  final String name;
  final DateTime at;
  final String props;
  const AnalyticsEventRow({
    required this.id,
    required this.name,
    required this.at,
    required this.props,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['name'] = Variable<String>(name);
    map['at'] = Variable<DateTime>(at);
    map['props'] = Variable<String>(props);
    return map;
  }

  AnalyticsEventsCompanion toCompanion(bool nullToAbsent) {
    return AnalyticsEventsCompanion(
      id: Value(id),
      name: Value(name),
      at: Value(at),
      props: Value(props),
    );
  }

  factory AnalyticsEventRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return AnalyticsEventRow(
      id: serializer.fromJson<int>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      at: serializer.fromJson<DateTime>(json['at']),
      props: serializer.fromJson<String>(json['props']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'name': serializer.toJson<String>(name),
      'at': serializer.toJson<DateTime>(at),
      'props': serializer.toJson<String>(props),
    };
  }

  AnalyticsEventRow copyWith({
    int? id,
    String? name,
    DateTime? at,
    String? props,
  }) => AnalyticsEventRow(
    id: id ?? this.id,
    name: name ?? this.name,
    at: at ?? this.at,
    props: props ?? this.props,
  );
  AnalyticsEventRow copyWithCompanion(AnalyticsEventsCompanion data) {
    return AnalyticsEventRow(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      at: data.at.present ? data.at.value : this.at,
      props: data.props.present ? data.props.value : this.props,
    );
  }

  @override
  String toString() {
    return (StringBuffer('AnalyticsEventRow(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('at: $at, ')
          ..write('props: $props')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, name, at, props);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AnalyticsEventRow &&
          other.id == this.id &&
          other.name == this.name &&
          other.at == this.at &&
          other.props == this.props);
}

class AnalyticsEventsCompanion extends UpdateCompanion<AnalyticsEventRow> {
  final Value<int> id;
  final Value<String> name;
  final Value<DateTime> at;
  final Value<String> props;
  const AnalyticsEventsCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.at = const Value.absent(),
    this.props = const Value.absent(),
  });
  AnalyticsEventsCompanion.insert({
    this.id = const Value.absent(),
    required String name,
    required DateTime at,
    required String props,
  }) : name = Value(name),
       at = Value(at),
       props = Value(props);
  static Insertable<AnalyticsEventRow> custom({
    Expression<int>? id,
    Expression<String>? name,
    Expression<DateTime>? at,
    Expression<String>? props,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (at != null) 'at': at,
      if (props != null) 'props': props,
    });
  }

  AnalyticsEventsCompanion copyWith({
    Value<int>? id,
    Value<String>? name,
    Value<DateTime>? at,
    Value<String>? props,
  }) {
    return AnalyticsEventsCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      at: at ?? this.at,
      props: props ?? this.props,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (at.present) {
      map['at'] = Variable<DateTime>(at.value);
    }
    if (props.present) {
      map['props'] = Variable<String>(props.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AnalyticsEventsCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('at: $at, ')
          ..write('props: $props')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $KvCacheTable kvCache = $KvCacheTable(this);
  late final $PendingActionRowsTable pendingActionRows =
      $PendingActionRowsTable(this);
  late final $AnalyticsEventsTable analyticsEvents = $AnalyticsEventsTable(
    this,
  );
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    kvCache,
    pendingActionRows,
    analyticsEvents,
  ];
}

typedef $$KvCacheTableCreateCompanionBuilder =
    KvCacheCompanion Function({
      required String key,
      required String json,
      required DateTime asOf,
      Value<int> rowid,
    });
typedef $$KvCacheTableUpdateCompanionBuilder =
    KvCacheCompanion Function({
      Value<String> key,
      Value<String> json,
      Value<DateTime> asOf,
      Value<int> rowid,
    });

class $$KvCacheTableFilterComposer
    extends Composer<_$AppDatabase, $KvCacheTable> {
  $$KvCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get asOf => $composableBuilder(
    column: $table.asOf,
    builder: (column) => ColumnFilters(column),
  );
}

class $$KvCacheTableOrderingComposer
    extends Composer<_$AppDatabase, $KvCacheTable> {
  $$KvCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get asOf => $composableBuilder(
    column: $table.asOf,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$KvCacheTableAnnotationComposer
    extends Composer<_$AppDatabase, $KvCacheTable> {
  $$KvCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get json =>
      $composableBuilder(column: $table.json, builder: (column) => column);

  GeneratedColumn<DateTime> get asOf =>
      $composableBuilder(column: $table.asOf, builder: (column) => column);
}

class $$KvCacheTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $KvCacheTable,
          KvCacheData,
          $$KvCacheTableFilterComposer,
          $$KvCacheTableOrderingComposer,
          $$KvCacheTableAnnotationComposer,
          $$KvCacheTableCreateCompanionBuilder,
          $$KvCacheTableUpdateCompanionBuilder,
          (
            KvCacheData,
            BaseReferences<_$AppDatabase, $KvCacheTable, KvCacheData>,
          ),
          KvCacheData,
          PrefetchHooks Function()
        > {
  $$KvCacheTableTableManager(_$AppDatabase db, $KvCacheTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$KvCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$KvCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$KvCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> json = const Value.absent(),
                Value<DateTime> asOf = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => KvCacheCompanion(
                key: key,
                json: json,
                asOf: asOf,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String key,
                required String json,
                required DateTime asOf,
                Value<int> rowid = const Value.absent(),
              }) => KvCacheCompanion.insert(
                key: key,
                json: json,
                asOf: asOf,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$KvCacheTable, KvCacheData>(table),
                  BaseReferences<_$AppDatabase, $KvCacheTable, KvCacheData>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$KvCacheTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $KvCacheTable,
      KvCacheData,
      $$KvCacheTableFilterComposer,
      $$KvCacheTableOrderingComposer,
      $$KvCacheTableAnnotationComposer,
      $$KvCacheTableCreateCompanionBuilder,
      $$KvCacheTableUpdateCompanionBuilder,
      (KvCacheData, BaseReferences<_$AppDatabase, $KvCacheTable, KvCacheData>),
      KvCacheData,
      PrefetchHooks Function()
    >;
typedef $$PendingActionRowsTableCreateCompanionBuilder =
    PendingActionRowsCompanion Function({
      required String id,
      required String type,
      required String payload,
      required DateTime createdAt,
      Value<int> attempts,
      Value<String?> lastError,
      Value<int> rowid,
    });
typedef $$PendingActionRowsTableUpdateCompanionBuilder =
    PendingActionRowsCompanion Function({
      Value<String> id,
      Value<String> type,
      Value<String> payload,
      Value<DateTime> createdAt,
      Value<int> attempts,
      Value<String?> lastError,
      Value<int> rowid,
    });

class $$PendingActionRowsTableFilterComposer
    extends Composer<_$AppDatabase, $PendingActionRowsTable> {
  $$PendingActionRowsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PendingActionRowsTableOrderingComposer
    extends Composer<_$AppDatabase, $PendingActionRowsTable> {
  $$PendingActionRowsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PendingActionRowsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PendingActionRowsTable> {
  $$PendingActionRowsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);
}

class $$PendingActionRowsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PendingActionRowsTable,
          PendingActionRow,
          $$PendingActionRowsTableFilterComposer,
          $$PendingActionRowsTableOrderingComposer,
          $$PendingActionRowsTableAnnotationComposer,
          $$PendingActionRowsTableCreateCompanionBuilder,
          $$PendingActionRowsTableUpdateCompanionBuilder,
          (
            PendingActionRow,
            BaseReferences<
              _$AppDatabase,
              $PendingActionRowsTable,
              PendingActionRow
            >,
          ),
          PendingActionRow,
          PrefetchHooks Function()
        > {
  $$PendingActionRowsTableTableManager(
    _$AppDatabase db,
    $PendingActionRowsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PendingActionRowsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PendingActionRowsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PendingActionRowsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PendingActionRowsCompanion(
                id: id,
                type: type,
                payload: payload,
                createdAt: createdAt,
                attempts: attempts,
                lastError: lastError,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String type,
                required String payload,
                required DateTime createdAt,
                Value<int> attempts = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PendingActionRowsCompanion.insert(
                id: id,
                type: type,
                payload: payload,
                createdAt: createdAt,
                attempts: attempts,
                lastError: lastError,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$PendingActionRowsTable, PendingActionRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $PendingActionRowsTable,
                    PendingActionRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PendingActionRowsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PendingActionRowsTable,
      PendingActionRow,
      $$PendingActionRowsTableFilterComposer,
      $$PendingActionRowsTableOrderingComposer,
      $$PendingActionRowsTableAnnotationComposer,
      $$PendingActionRowsTableCreateCompanionBuilder,
      $$PendingActionRowsTableUpdateCompanionBuilder,
      (
        PendingActionRow,
        BaseReferences<
          _$AppDatabase,
          $PendingActionRowsTable,
          PendingActionRow
        >,
      ),
      PendingActionRow,
      PrefetchHooks Function()
    >;
typedef $$AnalyticsEventsTableCreateCompanionBuilder =
    AnalyticsEventsCompanion Function({
      Value<int> id,
      required String name,
      required DateTime at,
      required String props,
    });
typedef $$AnalyticsEventsTableUpdateCompanionBuilder =
    AnalyticsEventsCompanion Function({
      Value<int> id,
      Value<String> name,
      Value<DateTime> at,
      Value<String> props,
    });

class $$AnalyticsEventsTableFilterComposer
    extends Composer<_$AppDatabase, $AnalyticsEventsTable> {
  $$AnalyticsEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get at => $composableBuilder(
    column: $table.at,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get props => $composableBuilder(
    column: $table.props,
    builder: (column) => ColumnFilters(column),
  );
}

class $$AnalyticsEventsTableOrderingComposer
    extends Composer<_$AppDatabase, $AnalyticsEventsTable> {
  $$AnalyticsEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get at => $composableBuilder(
    column: $table.at,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get props => $composableBuilder(
    column: $table.props,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$AnalyticsEventsTableAnnotationComposer
    extends Composer<_$AppDatabase, $AnalyticsEventsTable> {
  $$AnalyticsEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<DateTime> get at =>
      $composableBuilder(column: $table.at, builder: (column) => column);

  GeneratedColumn<String> get props =>
      $composableBuilder(column: $table.props, builder: (column) => column);
}

class $$AnalyticsEventsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $AnalyticsEventsTable,
          AnalyticsEventRow,
          $$AnalyticsEventsTableFilterComposer,
          $$AnalyticsEventsTableOrderingComposer,
          $$AnalyticsEventsTableAnnotationComposer,
          $$AnalyticsEventsTableCreateCompanionBuilder,
          $$AnalyticsEventsTableUpdateCompanionBuilder,
          (
            AnalyticsEventRow,
            BaseReferences<
              _$AppDatabase,
              $AnalyticsEventsTable,
              AnalyticsEventRow
            >,
          ),
          AnalyticsEventRow,
          PrefetchHooks Function()
        > {
  $$AnalyticsEventsTableTableManager(
    _$AppDatabase db,
    $AnalyticsEventsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$AnalyticsEventsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$AnalyticsEventsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$AnalyticsEventsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<DateTime> at = const Value.absent(),
                Value<String> props = const Value.absent(),
              }) => AnalyticsEventsCompanion(
                id: id,
                name: name,
                at: at,
                props: props,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String name,
                required DateTime at,
                required String props,
              }) => AnalyticsEventsCompanion.insert(
                id: id,
                name: name,
                at: at,
                props: props,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$AnalyticsEventsTable, AnalyticsEventRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $AnalyticsEventsTable,
                    AnalyticsEventRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$AnalyticsEventsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $AnalyticsEventsTable,
      AnalyticsEventRow,
      $$AnalyticsEventsTableFilterComposer,
      $$AnalyticsEventsTableOrderingComposer,
      $$AnalyticsEventsTableAnnotationComposer,
      $$AnalyticsEventsTableCreateCompanionBuilder,
      $$AnalyticsEventsTableUpdateCompanionBuilder,
      (
        AnalyticsEventRow,
        BaseReferences<_$AppDatabase, $AnalyticsEventsTable, AnalyticsEventRow>,
      ),
      AnalyticsEventRow,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$KvCacheTableTableManager get kvCache =>
      $$KvCacheTableTableManager(_db, _db.kvCache);
  $$PendingActionRowsTableTableManager get pendingActionRows =>
      $$PendingActionRowsTableTableManager(_db, _db.pendingActionRows);
  $$AnalyticsEventsTableTableManager get analyticsEvents =>
      $$AnalyticsEventsTableTableManager(_db, _db.analyticsEvents);
}
