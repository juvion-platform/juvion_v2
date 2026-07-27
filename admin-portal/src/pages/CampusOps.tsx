import { Routes, Route, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCampusOpsStats } from '../services/campus-ops';
import {
  Building2, DoorOpen, CalendarClock, Truck,
  ShieldCheck, Users, AlertTriangle, Camera, Phone,
  FlaskConical, ParkingCircle, Zap, Leaf, Droplets,
  Package, ArrowRightLeft, Wrench, CalendarCheck, HardHat,
  Store, ClipboardList, Boxes, ArrowDownUp, ClipboardCheck, UserCheck,
  Laptop, Network, ShieldAlert, Gauge, Trash2,
  BookOpen, BookMarked, BookCopy, IdCard, Banknote,
  DoorClosed, Globe, Newspaper,
} from 'lucide-react';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import { StatBannerSkeleton } from '../components/ui/Skeleton';

import AllocationProposalsPage from './campus/AllocationProposalsPage';
import MyCampusServicesPage from './campus/MyCampusServicesPage';
import BuildingsPage from './campus-ops/BuildingsPage';
import RoomsPage from './campus-ops/RoomsPage';
import RoomBookingsPage from './campus-ops/RoomBookingsPage';
import VehiclesPage from './campus-ops/VehiclesPage';
import GatePassesPage from './campus-ops/GatePassesPage';
import VisitorEntriesPage from './campus-ops/VisitorEntriesPage';
import SecurityIncidentsPage from './campus-ops/SecurityIncidentsPage';
import CCTVPage from './campus-ops/CCTVPage';
import EmergencyContactsPage from './campus-ops/EmergencyContactsPage';
import LabsPage from './campus-ops/LabsPage';
import ParkingSlotsPage from './campus-ops/ParkingSlotsPage';
import PowerBackupsPage from './campus-ops/PowerBackupsPage';
import GreenInitiativesPage from './campus-ops/GreenInitiativesPage';
import WaterSupplyPage from './campus-ops/WaterSupplyPage';
import AssetsPage from './campus-ops/AssetsPage';
import AssetAllocationsPage from './campus-ops/AssetAllocationsPage';
import MaintenanceRequestsPage from './campus-ops/MaintenanceRequestsPage';
import MaintenanceSchedulesPage from './campus-ops/MaintenanceSchedulesPage';
import ConstructionProjectsPage from './campus-ops/ConstructionProjectsPage';
import VendorsPage from './campus-ops/VendorsPage';
import PurchaseOrdersPage from './campus-ops/PurchaseOrdersPage';
import StockItemsPage from './campus-ops/StockItemsPage';
import StockTransactionsPage from './campus-ops/StockTransactionsPage';
import ITAssetsPage from './campus-ops/ITAssetsPage';
import NetworkInfraPage from './campus-ops/NetworkInfraPage';
import InsurancePage from './campus-ops/InsurancePage';
import EnergyConsumptionPage from './campus-ops/EnergyConsumptionPage';
import WasteManagementPage from './campus-ops/WasteManagementPage';
import BooksPage from './campus-ops/BooksPage';
import BookIssuesPage from './campus-ops/BookIssuesPage';
import BookReservationsPage from './campus-ops/BookReservationsPage';
import LibraryMembersPage from './campus-ops/LibraryMembersPage';
import LibraryFinesPage from './campus-ops/LibraryFinesPage';
import LibraryGateEntriesPage from './campus-ops/LibraryGateEntriesPage';
import EResourcesPage from './campus-ops/EResourcesPage';
import EResourceAccessPage from './campus-ops/EResourceAccessPage';
import PeriodicalSubscriptionsPage from './campus-ops/PeriodicalSubscriptionsPage';

function CampusOpsHome() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({ queryKey: ['campus-ops-stats'], queryFn: getCampusOpsStats });

  return (
    <div>
      <h2 className="text-2xl font-bold text-navy mb-6">Campus Operations</h2>

      {/* KPI Banner */}
      {!stats ? (
        <StatBannerSkeleton count={4} />
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <span className="text-xs font-medium text-blue-600 uppercase">Buildings</span>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.buildings || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <span className="text-xs font-medium text-green-600 uppercase">Assets</span>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.assets || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
            <span className="text-xs font-medium text-amber-600 uppercase">Open Maintenance</span>
            <div className="text-2xl font-bold text-amber-700 mt-1">{stats.maintenanceRequests || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4">
            <span className="text-xs font-medium text-purple-600 uppercase">Library Books</span>
            <div className="text-2xl font-bold text-purple-700 mt-1">{stats.books || 0}</div>
          </div>
        </div>
      )}

      {/* Service Allocations — these two routes existed but no card linked to
          them, so they were reachable only by typing the URL. */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Service Allocations</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { to: 'allocation-proposals', icon: ClipboardCheck, label: 'Allocation Proposals', desc: 'Review hostel & transport proposals', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400' },
          { to: 'my-services', icon: UserCheck, label: 'My Campus Services', desc: 'Your own hostel & transport allocations', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400' },
        ] as const).map(card => {
          const Icon = card.icon;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Campus Infrastructure */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Campus Infrastructure</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { to: 'buildings', icon: Building2, label: 'Buildings', desc: 'Campus buildings & blocks', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'buildings' },
          { to: 'rooms', icon: DoorOpen, label: 'Rooms', desc: 'Classrooms, labs & offices', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'rooms' },
          { to: 'room-bookings', icon: CalendarClock, label: 'Room Bookings', desc: 'Book rooms & halls', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'roomBookings' },
          { to: 'vehicles', icon: Truck, label: 'Vehicles', desc: 'Fleet management', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'vehicles' },
          { to: 'labs', icon: FlaskConical, label: 'Labs', desc: 'Laboratory management', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'labs' },
        ] as const).map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Security & Access */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Security & Access</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { to: 'gate-passes', icon: ShieldCheck, label: 'Gate Passes', desc: 'Entry & exit passes', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'gatePasses' },
          { to: 'visitor-entries', icon: Users, label: 'Visitor Entries', desc: 'Visitor registration', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400', statKey: 'visitorEntries' },
          { to: 'security-incidents', icon: AlertTriangle, label: 'Security Incidents', desc: 'Incident reports', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'securityIncidents' },
          { to: 'cctv', icon: Camera, label: 'CCTV', desc: 'Camera management', iconBg: 'bg-gray-100 text-gray-600', border: 'border-gray-200 hover:border-gray-400', statKey: 'cctvs' },
          { to: 'emergency-contacts', icon: Phone, label: 'Emergency Contacts', desc: 'Emergency numbers', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: 'emergencyContacts' },
        ] as const).map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Parking & Utilities */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Parking & Utilities</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { to: 'parking-slots', icon: ParkingCircle, label: 'Parking Slots', desc: 'Parking allocation', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'parkingSlots' },
          { to: 'power-backups', icon: Zap, label: 'Power Backups', desc: 'Generators & UPS', iconBg: 'bg-yellow-50 text-yellow-600', border: 'border-yellow-200 hover:border-yellow-400', statKey: 'powerBackups' },
          { to: 'green-initiatives', icon: Leaf, label: 'Green Initiatives', desc: 'Sustainability projects', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: 'greenInitiatives' },
          { to: 'water-supply', icon: Droplets, label: 'Water Supply', desc: 'Water management', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'waterSupplies' },
          { to: 'energy-consumption', icon: Gauge, label: 'Energy Consumption', desc: 'Energy tracking', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'energyConsumptions' },
          { to: 'waste-management', icon: Trash2, label: 'Waste Management', desc: 'Waste disposal', iconBg: 'bg-lime-50 text-lime-600', border: 'border-lime-200 hover:border-lime-400', statKey: 'wasteManagements' },
        ] as const).map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Assets & Procurement */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Assets & Procurement</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { to: 'assets', icon: Package, label: 'Assets', desc: 'Asset register', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'assets' },
          { to: 'asset-allocations', icon: ArrowRightLeft, label: 'Asset Allocations', desc: 'Assign & track assets', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'assetAllocations' },
          { to: 'vendors', icon: Store, label: 'Vendors', desc: 'Vendor directory', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'vendors' },
          { to: 'purchase-orders', icon: ClipboardList, label: 'Purchase Orders', desc: 'PO management', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'purchaseOrders' },
          { to: 'stock-items', icon: Boxes, label: 'Stock Items', desc: 'Inventory items', iconBg: 'bg-sky-50 text-sky-600', border: 'border-sky-200 hover:border-sky-400', statKey: 'stockItems' },
          { to: 'stock-transactions', icon: ArrowDownUp, label: 'Stock Transactions', desc: 'In/out movements', iconBg: 'bg-pink-50 text-pink-600', border: 'border-pink-200 hover:border-pink-400', statKey: 'stockTransactions' },
          { to: 'insurance', icon: ShieldAlert, label: 'Insurance', desc: 'Insurance policies', iconBg: 'bg-rose-50 text-rose-600', border: 'border-rose-200 hover:border-rose-400', statKey: 'insurances' },
        ] as const).map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Maintenance */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Maintenance</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { to: 'maintenance-requests', icon: Wrench, label: 'Maintenance Requests', desc: 'Repair & service requests', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'maintenanceRequests' },
          { to: 'maintenance-schedules', icon: CalendarCheck, label: 'Maintenance Schedules', desc: 'Planned maintenance', iconBg: 'bg-green-50 text-green-600', border: 'border-green-200 hover:border-green-400', statKey: 'maintenanceSchedules' },
          { to: 'construction-projects', icon: HardHat, label: 'Construction Projects', desc: 'Building & renovation', iconBg: 'bg-orange-50 text-orange-600', border: 'border-orange-200 hover:border-orange-400', statKey: 'constructionProjects' },
        ] as const).map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* IT Infrastructure */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">IT Infrastructure</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {([
          { to: 'it-assets', icon: Laptop, label: 'IT Assets', desc: 'Computers & devices', iconBg: 'bg-slate-100 text-slate-600', border: 'border-slate-200 hover:border-slate-400', statKey: 'itAssets' },
          { to: 'network-infra', icon: Network, label: 'Network Infra', desc: 'Network equipment', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'networkInfras' },
        ] as const).map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Library */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Library</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { to: 'books', icon: BookOpen, label: 'Books', desc: 'Book catalogue', iconBg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200 hover:border-emerald-400', statKey: 'books' },
          { to: 'book-issues', icon: BookMarked, label: 'Book Issues', desc: 'Issue & return', iconBg: 'bg-blue-50 text-blue-600', border: 'border-blue-200 hover:border-blue-400', statKey: 'bookIssues' },
          { to: 'book-reservations', icon: BookCopy, label: 'Book Reservations', desc: 'Reserve books', iconBg: 'bg-violet-50 text-violet-600', border: 'border-violet-200 hover:border-violet-400', statKey: 'bookReservations' },
          { to: 'library-members', icon: IdCard, label: 'Library Members', desc: 'Membership management', iconBg: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-200 hover:border-indigo-400', statKey: 'libraryMembers' },
          { to: 'library-fines', icon: Banknote, label: 'Library Fines', desc: 'Fine collection', iconBg: 'bg-red-50 text-red-600', border: 'border-red-200 hover:border-red-400', statKey: 'libraryFines' },
          { to: 'library-gate-entries', icon: DoorClosed, label: 'Gate Entries', desc: 'Library entry log', iconBg: 'bg-gray-100 text-gray-600', border: 'border-gray-200 hover:border-gray-400', statKey: 'libraryGateEntries' },
          { to: 'e-resources', icon: Globe, label: 'E-Resources', desc: 'Digital resources', iconBg: 'bg-cyan-50 text-cyan-600', border: 'border-cyan-200 hover:border-cyan-400', statKey: 'eResources' },
          { to: 'e-resource-access', icon: Globe, label: 'E-Resource Access', desc: 'Access tracking', iconBg: 'bg-teal-50 text-teal-600', border: 'border-teal-200 hover:border-teal-400', statKey: 'eResourceAccesses' },
          { to: 'periodical-subscriptions', icon: Newspaper, label: 'Periodicals', desc: 'Journals & magazines', iconBg: 'bg-amber-50 text-amber-600', border: 'border-amber-200 hover:border-amber-400', statKey: 'periodicalSubscriptions' },
        ] as const).map(card => {
          const Icon = card.icon;
          const hasStat = Boolean(card.statKey);
          const count = hasStat && stats ? ((stats as any)[card.statKey!] ?? 0) : null;
          return (
            <button key={card.to} onClick={() => navigate(card.to)} className={`bg-white rounded-xl border-2 shadow-sm p-5 text-left hover:shadow-lg transition-all ${card.border}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${card.iconBg}`}><Icon size={22} /></div>
              {hasStat && (count === null
                ? <div className="h-7 w-12 mb-1 animate-pulse rounded bg-slate-100" aria-hidden="true" />
                : <div className="text-2xl font-bold text-navy mb-1">{count}</div>)}
              <div className="font-semibold text-navy-dark text-sm">{card.label}</div>
              <p className="text-xs text-gray-500 mt-1">{card.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Breadcrumbs className="mb-4" />
      {children}
    </div>
  );
}

export default function CampusOps() {
  return (
    <SubPageWrapper>
      <Routes>
        <Route index element={<CampusOpsHome />} />
        {/* Optional Allotment (T16/T17/T18) */}
        <Route path="allocation-proposals" element={<AllocationProposalsPage />} />
        <Route path="my-services" element={<MyCampusServicesPage />} />
        {/* Campus Infrastructure */}
        <Route path="buildings" element={<BuildingsPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="room-bookings" element={<RoomBookingsPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="labs" element={<LabsPage />} />
        {/* Security & Access */}
        <Route path="gate-passes" element={<GatePassesPage />} />
        <Route path="visitor-entries" element={<VisitorEntriesPage />} />
        <Route path="security-incidents" element={<SecurityIncidentsPage />} />
        <Route path="cctv" element={<CCTVPage />} />
        <Route path="emergency-contacts" element={<EmergencyContactsPage />} />
        {/* Parking & Utilities */}
        <Route path="parking-slots" element={<ParkingSlotsPage />} />
        <Route path="power-backups" element={<PowerBackupsPage />} />
        <Route path="green-initiatives" element={<GreenInitiativesPage />} />
        <Route path="water-supply" element={<WaterSupplyPage />} />
        <Route path="energy-consumption" element={<EnergyConsumptionPage />} />
        <Route path="waste-management" element={<WasteManagementPage />} />
        {/* Assets & Procurement */}
        <Route path="assets" element={<AssetsPage />} />
        <Route path="asset-allocations" element={<AssetAllocationsPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="stock-items" element={<StockItemsPage />} />
        <Route path="stock-transactions" element={<StockTransactionsPage />} />
        <Route path="insurance" element={<InsurancePage />} />
        {/* Maintenance */}
        <Route path="maintenance-requests" element={<MaintenanceRequestsPage />} />
        <Route path="maintenance-schedules" element={<MaintenanceSchedulesPage />} />
        <Route path="construction-projects" element={<ConstructionProjectsPage />} />
        {/* IT Infrastructure */}
        <Route path="it-assets" element={<ITAssetsPage />} />
        <Route path="network-infra" element={<NetworkInfraPage />} />
        {/* Library */}
        <Route path="books" element={<BooksPage />} />
        <Route path="book-issues" element={<BookIssuesPage />} />
        <Route path="book-reservations" element={<BookReservationsPage />} />
        <Route path="library-members" element={<LibraryMembersPage />} />
        <Route path="library-fines" element={<LibraryFinesPage />} />
        <Route path="library-gate-entries" element={<LibraryGateEntriesPage />} />
        <Route path="e-resources" element={<EResourcesPage />} />
        <Route path="e-resource-access" element={<EResourceAccessPage />} />
        <Route path="periodical-subscriptions" element={<PeriodicalSubscriptionsPage />} />
      </Routes>
    </SubPageWrapper>
  );
}
