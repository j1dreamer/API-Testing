import Sidebar from '../components/Sidebar';

const MainLayout = ({ children, onLogout }) => {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white transition-colors duration-200">
            <Sidebar onLogout={onLogout} />
            <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden w-full">
                <main className="w-full flex-1">
                    <div className="w-full py-2">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
