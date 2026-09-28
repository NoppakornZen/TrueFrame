import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, Button } from '../ui';
import { useStore } from '../../store';
import { PolicyRule } from '../../types';
import { Edit, Trash2, Plus, Power, X } from 'lucide-react';

const EVIDENCE_TYPES: Array<'photo' | 'barcode' | 'document' | 'sensor' | 'video'> = [
  'photo', 'barcode', 'document', 'sensor', 'video',
];

interface PolicyFormState {
  id: string | null; // null = creating
  name: string;
  description: string;
  minimumConfidence: number; // 0-100
  requiredEvidenceTypes: string[];
}

const emptyForm: PolicyFormState = {
  id: null,
  name: '',
  description: '',
  minimumConfidence: 90,
  requiredEvidenceTypes: [],
};

const PolicyDashboard: React.FC = () => {
  const { policies, updatePolicy, addPolicy, removePolicy } = useStore();
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyFormState | null>(null);

  const togglePolicy = (policyId: string) => {
    const policy = policies.find((p) => p.id === policyId);
    if (policy) {
      updatePolicy(policyId, { enabled: !policy.enabled });
    }
  };

  const openAdd = () => setForm({ ...emptyForm });
  const openEdit = (policy: PolicyRule) => {
    setForm({
      id: policy.id,
      name: policy.name,
      description: policy.description,
      minimumConfidence: Math.round(policy.minimumConfidence * 100),
      requiredEvidenceTypes: [...policy.requiredEvidenceTypes],
    });
  };

  const toggleFormType = (type: string) => {
    if (!form) return;
    const has = form.requiredEvidenceTypes.includes(type);
    setForm({
      ...form,
      requiredEvidenceTypes: has
        ? form.requiredEvidenceTypes.filter((t) => t !== type)
        : [...form.requiredEvidenceTypes, type],
    });
  };

  const saveForm = () => {
    if (!form) return;
    if (!form.name.trim()) return;
    if (form.requiredEvidenceTypes.length === 0) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      minimumConfidence: form.minimumConfidence / 100,
      requiredEvidenceTypes: form.requiredEvidenceTypes,
    };

    if (form.id) {
      updatePolicy(form.id, payload);
    } else {
      addPolicy({
        id: `policy-${Date.now()}`,
        ...payload,
        conditions: [],
        enabled: true,
      });
    }
    setForm(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Policies</CardTitle>
          <Button variant="ghost" size="sm" onClick={openAdd}>
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="!px-0 !py-0">
        <ul>
          {policies.map((policy) => (
            <li key={policy.id} className={`border-b border-[var(--surface-3)] ${policy.enabled ? '' : 'opacity-50'}`}>
              <div
                className="flex cursor-pointer items-center gap-3 px-5 py-3"
                onClick={() => setExpandedPolicy(expandedPolicy === policy.id ? null : policy.id)}
              >
                <span className={`h-1.5 w-1.5 flex-shrink-0 ${policy.enabled ? 'bg-[var(--success)]' : 'bg-[var(--surface-5)]'}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{policy.name}</p>
                  <p className="font-mono text-[11px] text-[var(--text-tertiary)]">
                    {(policy.minimumConfidence * 100).toFixed(0)}% · {policy.requiredEvidenceTypes.join(', ')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePolicy(policy.id);
                  }}
                  aria-label={policy.enabled ? `Disable ${policy.name}` : `Enable ${policy.name}`}
                  className={policy.enabled ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'}
                >
                  <Power size={14} />
                </button>
              </div>

              {expandedPolicy === policy.id && (
                <div className="space-y-3 px-5 pb-4">
                  {policy.description && (
                    <p className="text-sm text-[var(--text-secondary)]">{policy.description}</p>
                  )}

                  {policy.conditions.length > 0 && (
                    <ul className="space-y-1">
                      {policy.conditions.map((condition, idx) => (
                        <li key={idx} className="font-mono text-xs text-[var(--text-secondary)]">
                          {condition.field} {condition.operator}{' '}
                          {typeof condition.value === 'boolean' ? String(condition.value) : condition.value}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(policy)}>
                      <Edit size={13} className="mr-1" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removePolicy(policy.id)} aria-label={`Delete ${policy.name}`}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="px-5 py-3 font-mono text-[11px] text-[var(--text-tertiary)]">
          {policies.filter((p) => p.enabled).length} of {policies.length} active
        </p>
      </CardContent>

      {/* Add/Edit Policy Modal */}
      {form && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1c1915]/70 p-4" onClick={() => setForm(null)}>
          <div
            className="w-full max-w-md border border-[var(--surface-4)] bg-[var(--surface-2)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">
                {form.id ? 'Edit policy' : 'New policy'}
              </h3>
              <button onClick={() => setForm(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Packaging integrity"
                  className="mt-1 w-full border border-[var(--surface-4)] bg-[var(--surface-1)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">What it checks</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="mt-1 w-full resize-none border border-[var(--surface-4)] bg-[var(--surface-1)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Minimum confidence {form.minimumConfidence}%
                </span>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={form.minimumConfidence}
                  onChange={(e) => setForm({ ...form, minimumConfidence: Number(e.target.value) })}
                  className="mt-2 w-full accent-[var(--accent)]"
                />
              </label>

              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Needs</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EVIDENCE_TYPES.map((type) => {
                    const selected = form.requiredEvidenceTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleFormType(type)}
                        className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] ${
                          selected
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--surface-2)]'
                            : 'border-[var(--surface-4)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={saveForm}
                  disabled={!form.name.trim() || form.requiredEvidenceTypes.length === 0}
                >
                  {form.id ? 'Save' : 'Add policy'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PolicyDashboard;
