import { LeftSidebar } from '../components';
import RightContent from '../components/RightContent';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setActiveChannel } from '../features/channels/channel.slice';
const Home = () => {
  const [searchParams] = useSearchParams()
  const dispatch = useDispatch()
  const channelId = searchParams.get("channelId")

  useEffect(() => {
    if (channelId) dispatch(setActiveChannel(channelId))
  }, [channelId, dispatch])

  return (
    <div className='min-w-screen flex'>
      <LeftSidebar/>
      <RightContent/>
    </div>
  );
};

export default Home;
