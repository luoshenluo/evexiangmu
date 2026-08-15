import ForumDetail from '@/components/ForumDetail'

export const runtime = 'edge'

export default function ForumDetailPage({ params }: { params: { id: string } }) {
  return <ForumDetail postId={params.id} />
}