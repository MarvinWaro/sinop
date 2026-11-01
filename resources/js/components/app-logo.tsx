import AppLogoIcon from '@/components/app-logo-icon';

const LETTERS = ['S', 'I', 'N', 'O', 'P'];

export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-white p-0.5 ring-1 ring-sidebar-border">
                <AppLogoIcon className="size-7" />
            </div>
            {/* The name spread across the sidebar, one red-to-blue gradient over all its letters. */}
            <span className="ml-1 flex flex-1 justify-between bg-linear-to-r from-[#d61f2c] to-[#0057d2] bg-clip-text pr-1 text-xl leading-none font-extrabold text-transparent dark:from-[#ff6b6b] dark:to-[#6bc0ff]">
                <span className="sr-only">SINOP</span>
                {LETTERS.map((letter, index) => (
                    <span key={index} aria-hidden="true">
                        {letter}
                    </span>
                ))}
            </span>
        </>
    );
}
