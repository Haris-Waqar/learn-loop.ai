import { LoopWorkspaceShell } from '@/components/loop-workspace-shell';

export default async function LoopWorkspacePage(props: PageProps<'/loops/[loopId]'>) {
  const { loopId } = await props.params;

  return <LoopWorkspaceShell loopId={loopId} />;
}
