class Booking {
  final String id;
  final String patientId;
  final String clinicId;
  final String clinicName;
  final String? doctorId;
  final String? doctorName;
  final String status;
  final int? queueNumber;
  final DateTime? bookedAt;
  final DateTime? servedAt;
  final String? clinicAddress;

  Booking({
    required this.id,
    required this.patientId,
    required this.clinicId,
    required this.clinicName,
    this.doctorId,
    this.doctorName,
    required this.status,
    this.queueNumber,
    this.bookedAt,
    this.servedAt,
    this.clinicAddress,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: json['_id'] ?? json['id'] ?? '',
      patientId: json['patientId'] ?? json['patient']?['_id'] ?? '',
      clinicId: json['clinicId'] ?? json['clinic']?['_id'] ?? '',
      clinicName: json['clinic']?['name'] ?? '',
      doctorId: json['doctorId'] ?? json['doctor']?['_id'],
      doctorName: json['doctor']?['name'],
      status: json['status'] ?? 'unknown',
      queueNumber: json['number'],
      bookedAt: json['bookedAt'] != null ? DateTime.parse(json['bookedAt']) : null,
      servedAt: json['servedAt'] != null ? DateTime.parse(json['servedAt']) : null,
      clinicAddress: json['clinic']?['address'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patientId': patientId,
      'clinicId': clinicId,
      'clinicName': clinicName,
      'doctorId': doctorId,
      'doctorName': doctorName,
      'status': status,
      'queueNumber': queueNumber,
      'bookedAt': bookedAt?.toIso8601String(),
      'servedAt': servedAt?.toIso8601String(),
      'clinicAddress': clinicAddress,
    };
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'patientId': patientId,
      'clinicId': clinicId,
      'clinicName': clinicName,
      'doctorId': doctorId,
      'doctorName': doctorName,
      'status': status,
      'queueNumber': queueNumber,
      'bookedAt': bookedAt?.millisecondsSinceEpoch,
      'servedAt': servedAt?.millisecondsSinceEpoch,
      'clinicAddress': clinicAddress,
    };
  }

  factory Booking.fromMap(Map<String, dynamic> map) {
    return Booking(
      id: map['id'] ?? '',
      patientId: map['patientId'] ?? '',
      clinicId: map['clinicId'] ?? '',
      clinicName: map['clinicName'] ?? '',
      doctorId: map['doctorId'],
      doctorName: map['doctorName'],
      status: map['status'] ?? 'unknown',
      queueNumber: map['queueNumber'],
      bookedAt: map['bookedAt'] != null ? DateTime.fromMillisecondsSinceEpoch(map['bookedAt']) : null,
      servedAt: map['servedAt'] != null ? DateTime.fromMillisecondsSinceEpoch(map['servedAt']) : null,
      clinicAddress: map['clinicAddress'],
    );
  }
}