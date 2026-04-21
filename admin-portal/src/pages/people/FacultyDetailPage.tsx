import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { getFaculty } from '../../services/people';
import Badge from '../../components/ui/Badge';
import {
  DetailSection, DetailField, DetailBool, formatDate, extractPerson,
} from '../../components/ui/DetailView';

/**
 * Read-only view for a single Faculty member. Edit navigates to the
 * existing `/people/faculty/:id/edit` form page.
 */

const STATUS_COLOR: Record<string, string> = {
  active: 'success', on_leave: 'warning', separated: 'danger',
};

export default function FacultyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: f, isLoading, error } = useQuery({
    queryKey: ['faculty', id],
    queryFn: () => getFaculty(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (error || !f) {
    return (
      <div className="py-20 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <div className="text-gray-700 font-medium">Couldn't load faculty record</div>
        <Link to="/people/faculty" className="inline-flex items-center gap-1 text-sm text-primary-600 mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Faculty
        </Link>
      </div>
    );
  }

  const person = extractPerson(f);
  const address = person.address || {};
  const emergency = person.emergencyContact || {};
  const departmentName = f.departmentId?.name ?? f.department?.name;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/people/faculty" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Faculty
          </Link>
          <h1 className="text-2xl font-bold text-navy">{person.name || 'Faculty'}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            {f.employeeCode && <span className="font-mono">{f.employeeCode}</span>}
            {f.employeeCode && f.status && <span>·</span>}
            {f.status && (
              <Badge variant={STATUS_COLOR[f.status] || 'default'}>{f.status.replace(/_/g, ' ')}</Badge>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/people/faculty/${id}/edit`)}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          <Pencil className="w-4 h-4" /> Edit
        </button>
      </div>

      <DetailSection title="Personal Information">
        <DetailField label="Full Name" value={person.name} />
        <DetailField label="Gender" value={person.gender} />
        <DetailField label="Date of Birth" value={formatDate(person.dob)} />
        <DetailField label="Phone" value={person.phone} />
        <DetailField label="Alternate Phone" value={person.alternatePhone} />
        <DetailField label="Email" value={person.email} />
        <DetailField label="Aadhaar" value={person.aadhaar} mono />
        <DetailField label="Preferred Language" value={person.preferredLanguage} />
        <DetailBool label="Biometric Enrolled" value={person.biometricEnrolled} />
      </DetailSection>

      <DetailSection title="Employment">
        <DetailField label="Employee Code" value={f.employeeCode} mono />
        <DetailField label="Designation" value={f.designation} />
        <DetailField label="Department" value={departmentName} />
        <DetailField label="Qualification" value={f.qualification} />
        <DetailField label="Specialization" value={f.specialization} />
        <DetailField label="Contract Type" value={f.contractType} />
        <DetailField label="Status">
          <Badge variant={STATUS_COLOR[f.status] || 'default'}>
            {f.status?.replace(/_/g, ' ') || '—'}
          </Badge>
        </DetailField>
      </DetailSection>

      <DetailSection title="Address" columns={3}>
        <DetailField label="Address Line 1" value={address.line1} wide />
        <DetailField label="Address Line 2" value={address.line2} wide />
        <DetailField label="City" value={address.city} />
        <DetailField label="State" value={address.state} />
        <DetailField label="Pincode" value={address.pincode} />
      </DetailSection>

      <DetailSection title="Emergency Contact" columns={3}>
        <DetailField label="Name" value={emergency.name} />
        <DetailField label="Phone" value={emergency.phone} />
        <DetailField label="Relationship" value={emergency.relationship} />
      </DetailSection>
    </div>
  );
}
