import { useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardHeader, CardContent, CardTitle, Badge } from '../ui';
import { useStore } from '../../store';
import { EvidenceDecisionEngine } from '../../services/decisionEngine';

const nodeTypes = {
  evidence: EvidenceNode,
  policy: PolicyNode,
  decision: DecisionNode,
};

function EvidenceNode({ data }: any) {
  const getStatusColor = (status: string) => {
    const colors = {
      approved: 'var(--success)',
      rejected: 'var(--danger)',
      pending: 'var(--warning)',
      conflict: 'var(--danger)',
    };
    return colors[status as keyof typeof colors] || 'var(--text-tertiary)';
  };

  return (
    <div
      className="border border-[var(--surface-4)] bg-[var(--surface-2)] px-4 py-3 shadow-none min-w-[170px]"
      style={{ borderColor: getStatusColor(data.status) }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: getStatusColor(data.status) }}
        />
        <span className="text-sm font-medium">{data.label}</span>
      </div>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{data.type}</p>
      {data.confidence && (
        <p className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]">
          {(data.confidence * 100).toFixed(0)}%
        </p>
      )}
    </div>
  );
}

function PolicyNode({ data }: any) {
  return (
    <div className="min-w-[190px] border border-[var(--accent)] bg-[var(--surface-2)] px-4 py-3">
      <span className="text-sm font-medium">{data.label}</span>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Policy</p>
      {data.satisfied !== undefined && (
        <Badge variant={data.satisfied ? 'success' : 'danger'} className="mt-2">
          {data.satisfied ? 'Satisfied' : 'Not Satisfied'}
        </Badge>
      )}
    </div>
  );
}

function DecisionNode({ data }: any) {
  const getDecisionColor = (decision: string) => {
    const colors = {
      accept: 'var(--success)',
      reject: 'var(--danger)',
      needs_review: 'var(--warning)',
    };
    return colors[decision as keyof typeof colors] || 'var(--text-tertiary)';
  };

  return (
    <div
      className="min-w-[200px] border-2 bg-[var(--surface-2)] px-5 py-4"
      style={{ borderColor: getDecisionColor(data.decision) }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: getDecisionColor(data.decision) }}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Decision</span>
      </div>
      <p className="font-display text-2xl font-semibold" style={{ color: getDecisionColor(data.decision) }}>
        {String(data.decision).replace('_', ' ')}
      </p>
      {data.confidence && (
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Confidence: {(data.confidence * 100).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

const EvidenceGraph = () => {
  const { evidence, policies, decision } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Evidence nodes (top row)
    evidence.forEach((ev, idx) => {
      newNodes.push({
        id: `evidence-${ev.id}`,
        type: 'evidence',
        position: { x: idx * 220 + 50, y: 50 },
        data: {
          label: ev.name.slice(0, 20),
          type: ev.type,
          status: ev.status,
          confidence: ev.aiAnalysis?.confidence,
        },
      });
    });

    const activePolicies = policies.filter((p) => p.enabled).slice(0, 6);

    // Policy nodes (middle row)
    activePolicies.forEach((policy, idx) => {
      const policyId = `policy-${policy.id}`;
      const satisfied = decision
        ? EvidenceDecisionEngine.isPolicySatisfied(evidence, policy, decision.conflicts)
        : undefined;
      newNodes.push({
        id: policyId,
        type: 'policy',
        position: { x: idx * 250 + 100, y: 200 },
        data: {
          label: policy.name.slice(0, 25),
          satisfied,
        },
      });

      // Connect evidence to policies
      evidence.forEach((ev) => {
        if (policy.requiredEvidenceTypes.includes(ev.type)) {
          const tone =
            ev.status === 'approved'
              ? 'var(--success)'
              : ev.status === 'conflict' || ev.status === 'rejected'
                ? 'var(--danger)'
                : 'var(--text-tertiary)';
          newEdges.push({
            id: `edge-${ev.id}-${policy.id}`,
            source: `evidence-${ev.id}`,
            target: policyId,
            type: 'smoothstep',
            animated: ev.status === 'approved',
            style: {
              stroke: tone,
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: tone,
            },
          });
        }
      });
    });

    // Decision node (bottom)
    if (decision) {
      const decisionId = 'final-decision';
      newNodes.push({
        id: decisionId,
        type: 'decision',
        position: { x: 400, y: 400 },
        data: {
          decision: decision.decision,
          confidence: decision.confidence,
        },
      });

      // Connect policies to decision
      activePolicies.forEach((policy) => {
        const satisfied = EvidenceDecisionEngine.isPolicySatisfied(
          evidence,
          policy,
          decision.conflicts
        );
        newEdges.push({
          id: `edge-${policy.id}-decision`,
          source: `policy-${policy.id}`,
          target: decisionId,
          type: 'smoothstep',
          animated: satisfied,
          style: {
            stroke: satisfied ? 'var(--success)' : 'var(--danger)',
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: satisfied ? 'var(--success)' : 'var(--danger)',
          },
        });
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [evidence, policies, decision, setNodes, setEdges]);

  return (
    <Card className="h-[560px]">
      <CardHeader>
        <CardTitle>How it connects</CardTitle>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Evidence feeds the policies. The policies make the decision.
        </p>
      </CardHeader>
      <CardContent className="h-[calc(100%-100px)]">
        <div className="h-full w-full bg-[var(--surface-1)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
          >
            <Background color="var(--surface-4)" gap={16} />
            <Controls className="overflow-hidden border border-[var(--surface-4)] bg-[var(--surface-2)]" />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'evidence') return '#1e4a38';
                if (node.type === 'policy') return '#8a5a12';
                return '#1d6b43';
              }}
              bgColor="#f3eee4"
              maskColor="rgba(230, 224, 212, 0.75)"
              className="border border-[var(--surface-4)]"
            />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
};

export default EvidenceGraph;
