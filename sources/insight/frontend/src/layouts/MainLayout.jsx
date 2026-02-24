import Sidebar from '../components/Sidebar';

const MainLayout = ({ children, onLogout }) => {
    return (
        <div className="flex h-screen overflow-hidden bg-gray-900 text-white">
            <Sidebar onLogout={onLogout} />
            <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                <main>
                    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
