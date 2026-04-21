import { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { getClosestHandle } from '../utils/graphUtils';

declare global {
  interface Window {
    __rfConnecting: boolean;
  }
}

interface CustomNodeProps {
  data: { label: string };
  selected: boolean;
  id: string;
}

export const CustomNode = ({ data, selected, id }: CustomNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConnectingFrom, setIsConnectingFrom] = useState(false);
  const [sourceHighlight, setSourceHighlight] = useState<string | null>(null);
  const [targetHighlight, setTargetHighlight] = useState<string | null>(null);
  const [closestHandle, setClosestHandle] = useState<string | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleConnectStart = (event: CustomEvent) => {
      if (event.detail.sourceId === id) {
        setSourceHighlight(event.detail.handleId);
        setIsConnectingFrom(true);
      }
    };
    const handleConnectMove = (event: CustomEvent) => {
      if (event.detail.targetId === id && event.detail.handleId) {
        setTargetHighlight(event.detail.handleId);
      } else if (event.detail.targetId !== id) {
        setTargetHighlight(null);
      }
    };
    const handleConnectEnd = () => {
      setSourceHighlight(null);
      setTargetHighlight(null);
      setIsConnectingFrom(false);
    };

    window.addEventListener('rf-connect-start', handleConnectStart as EventListener);
    window.addEventListener('rf-connect-move', handleConnectMove as EventListener);
    window.addEventListener('rf-connect-end', handleConnectEnd);
    return () => {
      window.removeEventListener('rf-connect-start', handleConnectStart as EventListener);
      window.removeEventListener('rf-connect-move', handleConnectMove as EventListener);
      window.removeEventListener('rf-connect-end', handleConnectEnd);
    };
  }, [id]);

  // 监听鼠标移动，计算最近的锚点
  useEffect(() => {
    if (!nodeRef.current || !isHovered) {
      setClosestHandle(null);
      return;
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!nodeRef.current) return;
      const rect = nodeRef.current.getBoundingClientRect();
      const closest = getClosestHandle(e.clientX, e.clientY, rect.left, rect.top, rect.width, rect.height);
      setClosestHandle(closest);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isHovered]);

  const isHighlighted = (handleId: string) => {
    // 连线过程中的高亮
    if (sourceHighlight === handleId || targetHighlight === handleId) return true;
    // 鼠标靠近时的高亮
    if (isHovered && closestHandle === handleId && !window.__rfConnecting) return true;
    return false;
  };

  const showHandles = isHovered || isConnectingFrom || selected;

  const getHandleStyle = (handleId: string) => {
    const active = isHighlighted(handleId);
    if (!showHandles && !active) {
      return { opacity: 0, pointerEvents: 'none' };
    }
    let bgColor = '#8E8E93';
    if (active) {
      bgColor = '#FF9F0A';
    } else if (isHovered) {
      bgColor = '#007AFF';
    }
    return {
      background: bgColor,
      width: active ? 12 : (isHovered ? 10 : 8),
      height: active ? 12 : (isHovered ? 10 : 8),
      transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
      opacity: 1,
      pointerEvents: 'auto' as const,
      border: '2px solid white',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    };
  };

  return (
    <div
      ref={nodeRef}
      style={{
        background: '#FFFFFF',
        border: selected ? '1.5px solid #FF9F0A' : '1px solid #E5E5EA',
        borderRadius: 10,
        padding: '8px 16px',
        minWidth: 70,
        textAlign: 'center',
        position: 'relative',
        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
        fontSize: 13,
        fontWeight: 500,
        color: '#1C1C1E',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setClosestHandle(null);
      }}
    >
      {/* 四个源锚点 */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        data-handleid="top"
        style={{
          ...getHandleStyle('top'),
          top: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        data-handleid="bottom"
        style={{
          ...getHandleStyle('bottom'),
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        data-handleid="left"
        style={{
          ...getHandleStyle('left'),
          left: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        data-handleid="right"
        style={{
          ...getHandleStyle('right'),
          right: -8,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
        }}
      />

      {/* 目标锚点（透明接收器） */}
      <Handle type="target" position={Position.Top} id="top" data-handleid="top" style={{ opacity: 0, top: -8, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', width: 12, height: 12 }} />
      <Handle type="target" position={Position.Bottom} id="bottom" data-handleid="bottom" style={{ opacity: 0, bottom: -8, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', width: 12, height: 12 }} />
      <Handle type="target" position={Position.Left} id="left" data-handleid="left" style={{ opacity: 0, left: -8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'auto', width: 12, height: 12 }} />
      <Handle type="target" position={Position.Right} id="right" data-handleid="right" style={{ opacity: 0, right: -8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'auto', width: 12, height: 12 }} />

      <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.2px' }}>{data.label}</div>
    </div>
  );
};