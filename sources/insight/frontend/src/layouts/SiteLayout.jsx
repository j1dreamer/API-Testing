import { Outlet, useParams } from 'react-router-dom';
import SiteSidebar from '../components/Sidebar/SiteSidebar';

const SiteLayout = ({ onLogout, userRole }) => {
    const { siteId } = useParams();
    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#020617] text-white">
            <SiteSidebar siteId={siteId} onLogout={onLogout} userRole={userRole} />
            <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <main className="w-full flex-1">
                    <div className="w-full py-2">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SiteLayout;
