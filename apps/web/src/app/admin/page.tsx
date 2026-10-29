'use client';

import { useState } from 'react';
import { useOrganization, useUsers } from '@/lib/queries';
import Tabs from '@/components/ui/Tabs';
import Overview from '@/components/admin/Overview';
import TeamPanel from '@/components/admin/TeamPanel';
import ApproverGroups from '@/components/admin/ApproverGroups';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'team', label: 'Team' },
  { key: 'groups', label: 'Groups' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  const { data: org } = useOrganization();
  const { data: users = [] } = useUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-navy-900">Admin</h1>
        <p className="text-navy-500 mt-1">{org ? `${org.name}: team, groups and activity` : 'Team, groups and activity'}</p>
      </div>

      <div className="overflow-x-auto">
        <Tabs
          tabs={[...TABS.slice(0, 1), { ...TABS[1]!, count: users.length || undefined }, ...TABS.slice(2)]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'team' && <TeamPanel />}
      {tab === 'groups' && <ApproverGroups users={users} />}
    </div>
  );
}
