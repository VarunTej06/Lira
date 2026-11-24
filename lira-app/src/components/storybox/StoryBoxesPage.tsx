import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStoredList } from '../../hooks/useStoredList';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { isInvitedMember } from '../../utils/hostedOrg';
import { boxRows } from '../../utils/storyOverview';
import { sprintsOf, type StoryBox } from '../../utils/storybox';
import { confirmDialog } from '../common/dialogStore';
import { NewStoryBoxModal } from './NewStoryBoxModal';
import { StoryBoxBoard } from './StoryBoxBoard';
import { StoryBoxesOverview } from './StoryBoxesOverview';
import { useBoxSummaries } from './useBoxSummaries';

const KEY = 'lira_storyboxes';

/**
 * Story boxes: estimating story points together. /storyboxes is the overview (the boxes being worked on, what each has sized, and the
 * older ones as history); a box opens as its planning room. The people who run a workspace (everyone, in the local edition) make boxes
 * and close them; everyone who may see a box gives their own points.
 */
export function StoryBoxesPage({ issues, spaces }: { issues: Issue[]; spaces: Space[] }) {
  const [boxes, saveBoxes] = useStoredList<StoryBox>(KEY);
  const summaries = useBoxSummaries(boxes);
  const { boxId } = useParams();
  const navigate = useNavigate();
  const canManage = !isInvitedMember();
  const [creating, setCreating] = useState(false);
  const box = boxes.find(b => b.id === boxId);

  async function remove(b: StoryBox) {
    if (!(await confirmDialog({ title: `Delete "${b.name}"?`, message: 'The box and everyone\'s points in it are deleted. Points already put on tickets stay.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    saveBoxes(boxes.filter(x => x.id !== b.id));
    navigate('/storyboxes');
  }

  if (box) {
    return <StoryBoxBoard box={box} issues={issues} spaces={spaces} canManage={canManage} onBack={() => navigate('/storyboxes')} onChange={next => saveBoxes(boxes.map(b => (b.id === next.id ? next : b)))} onDelete={() => { void remove(box); }} />;
  }
  return (
    <>
      <StoryBoxesOverview rows={boxRows(boxes, issues, summaries)} spaces={spaces} canManage={canManage} onOpen={id => navigate(`/storyboxes/${id}`)} onCreate={() => setCreating(true)} />
      <NewStoryBoxModal isOpen={creating} onClose={() => setCreating(false)} spaces={spaces} sprints={sprintsOf(issues)}
        onCreate={made => { saveBoxes([...boxes, made]); setCreating(false); navigate(`/storyboxes/${made.id}`); }} />
    </>
  );
}
