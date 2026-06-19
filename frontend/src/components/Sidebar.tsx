import { Logo } from "../icons/Logo"
import { TwitterIcon } from "../icons/TwitterIcon"
import { YoutubeIcon } from "../icons/YoutubeIcon"
import { SidebarItem } from "./SidebarItem"

export function Sidebar(){
    return <div className="h-screen bg-white border-r w-72 fixed left-0 top-0 border-gray-200 pl-6 pt-2">
        <div className="flex text-2xl pl-4 items-center pt-8">
            <div className="pr-2 text-purple-600">
                <Logo />
            </div>
            Brainly
        </div>
        <div className="pt-8 pl-4">
            <SidebarItem text={"Twitter"} icon={<TwitterIcon/>} />
            <SidebarItem text={"Youtube"} icon={<YoutubeIcon/>} />
        </div>
    </div>
}