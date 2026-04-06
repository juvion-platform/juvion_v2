import { Users, GraduationCap, IndianRupee, TrendingUp, UserPlus, BookOpen, Heart, Building2 } from 'lucide-react';
import StatCard from '../components/ui/StatCard';

const STATS = [
  { label: 'Total Students', value: '4,250', icon: Users, color: 'bg-primary-50 text-primary-500' },
  { label: 'Active Faculty', value: '312', icon: GraduationCap, color: 'bg-teal-50 text-teal-600' },
  { label: 'Fee Collection (YTD)', value: '\u20B98.2 Cr', icon: IndianRupee, color: 'bg-orange-50 text-orange-500' },
  { label: 'Placement Rate', value: '87%', icon: TrendingUp, color: 'bg-accent-50 text-accent-500' },
  { label: 'New Admissions', value: '1,120', icon: UserPlus, color: 'bg-primary-100 text-primary-700' },
  { label: 'Active Courses', value: '248', icon: BookOpen, color: 'bg-teal-100 text-teal-700' },
  { label: 'Hostel Occupancy', value: '92%', icon: Heart, color: 'bg-accent-100 text-accent-600' },
  { label: 'Rooms Available', value: '45', icon: Building2, color: 'bg-orange-100 text-orange-600' },
];

export default function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => <StatCard key={s.label} {...s} />)}
      </div>
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-navy-dark mb-3">Recent Activity</h3>
          <p className="text-sm text-gray-400">Activity feed will appear here...</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h3 className="font-semibold text-navy-dark mb-3">Upcoming Events</h3>
          <p className="text-sm text-gray-400">Calendar events will appear here...</p>
        </div>
      </div>
    </div>
  );
}
