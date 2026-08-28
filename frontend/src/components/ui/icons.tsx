/**
 * Velontri Central Icon System
 * ─────────────────────────────────────────────────────────────────────────────
 * All UI icons go through this file.
 * Source library: @phosphor-icons/react v2 (replaces lucide-react)
 *
 * Weight conventions:
 *   regular  — default for all interface icons
 *   fill     — active nav states, primary CTAs, important status
 *   bold     — strong emphasis, warnings, critical actions
 *
 * Usage:
 *   import { IconSearch, IconMenu, IconHeart } from '@/components/ui/icons';
 *   <IconSearch className="h-5 w-5" />
 *
 * Size: pass className="h-4 w-4" etc — matches Lucide sizing convention.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export {
  // ── NavigationArrow ────────────────────────────────────────────────────────────
 House as IconHome,
 House as IconHouseFill, // filled variant for active states
 MagnifyingGlass as IconSearch,
 List as IconMenu,
 X as IconClose,
 ArrowLeft as IconArrowLeft,
 ArrowRight as IconArrowRight,
 ArrowUp as IconArrowUp,
 ArrowDown as IconArrowDown,
 CaretDown as IconChevronDown,
 CaretUp as IconChevronUp,
 CaretLeft as IconChevronLeft,
 CaretRight as IconChevronRight,
 DotsThreeVertical as IconMoreVertical,
 DotsThree as IconMoreHorizontal,

  // ── User / Auth ──────────────────────────────────────────────────────────
 User as IconUser,
 UserCircle as IconUserCircle,
 Users as IconUsers,
 UserPlus as IconUserPlus,
 IdentificationCard as IconBadge,
 ShieldCheck as IconShieldCheck,
 Shield as IconShield,
 Lock as IconLock,
 LockOpen as IconLockOpen,
 Key as IconKey,
 Eye as IconEye,
 EyeSlash as IconEyeOff,
 SignOut as IconLogOut,
 SignIn as IconLogIn,

  // ── Marketplace / Listings ───────────────────────────────────────────────
 Tag as IconTag,
 Package as IconPackage,
 Storefront as IconStore,
 ShoppingBag as IconShoppingBag,
 ShoppingCart as IconShoppingCart,
 Heart as IconHeart,
 BookmarkSimple as IconBookmark,
 Star as IconStar,
 Star as IconStarFill, // use weight="fill" prop for filled variant
 SealCheck as IconSealCheck,
 SealCheck as IconBadgeCheck,
 CheckCircle as IconCheckCircle,
 XCircle as IconXCircle,

  // ── Categories ───────────────────────────────────────────────────────────
 Car as IconCar,
 House as IconProperty,
 DeviceMobile as IconPhone,
 TShirt as IconShirt,
 Briefcase as IconBriefcase,
 Wrench as IconWrench,
 Leaf as IconLeaf,
 FirstAid as IconFirstAid,
 Football as IconSports,
 BookOpen as IconBook,
 Couch as IconSofa,

  // ── Actions ──────────────────────────────────────────────────────────────
 Plus as IconPlus,
 Minus as IconMinus,
 PencilSimple as IconEdit,
 Trash as IconTrash,
 UploadSimple as IconUpload,
 DownloadSimple as IconDownload,
 Copy as IconCopy,
 Share as IconShare,
 ShareNetwork as IconShareNetwork,
 Export as IconExport,
 ArrowClockwise as IconRefresh,
 FloppyDisk as IconSave,

  // ── Communication ────────────────────────────────────────────────────────
 ChatCircle as IconMessage,
 ChatCircleDots as IconMessageDots,
 ChatTeardropDots as IconChatTeardropDots,
 Bell as IconBell,
 BellSimple as IconBellSimple,
 Phone as IconPhoneCall,
 WhatsappLogo as IconWhatsapp,
 EnvelopeSimple as IconEmail,
 PaperPlaneRight as IconSend,

  // ── Info / Status ────────────────────────────────────────────────────────
 Info as IconInfo,
 Warning as IconWarning,
 WarningCircle as IconWarningCircle,
 CheckCircle as IconSuccess,
 XCircle as IconError,
 CircleNotch as IconSpinner,
 Spinner as IconLoader,
 Clock as IconClock,
 Timer as IconTimer,
 CalendarBlank as IconCalendar,

  // ── Media ────────────────────────────────────────────────────────────────
 Camera as IconCamera,
 Image as IconImage,
 Images as IconImages,
 VideoCamera as IconVideo,
 Play as IconPlay,
 Pause as IconPause,
 FileText as IconFile,
 FilePdf as IconFilePdf,

  // ── Location ─────────────────────────────────────────────────────────────
 MapPin as IconMapPin,
 MapPin as IconMapPinFill, // use weight="fill" prop for filled variant
 Globe as IconGlobe,
 NavigationArrow as IconNavigation,

  // ── Finance / Payments ────────────────────────────────────────────────────
 CreditCard as IconCreditCard,
 Wallet as IconWallet,
 Money as IconMoney,
 CurrencyNgn as IconCurrencyNgn,
 CurrencyDollar as IconCurrencyDollar,
 Receipt as IconReceipt,
 Percent as IconPercent,

  // ── Dashboard / Analytics ─────────────────────────────────────────────────
 SquaresFour as IconDashboard,
 ChartLine as IconChartLine,
 ChartBar as IconChartBar,
 TrendUp as IconTrendUp,
 TrendDown as IconTrendDown,
 Pulse as IconActivity,

  // ── Gear / Config ─────────────────────────────────────────────────────
 Gear as IconSettings,
 Sliders as IconSliders,
 SlidersHorizontal as IconSlidersHorizontal,
 Funnel as IconFilter,
 MagnifyingGlass as IconZoomIn,
 SquaresFour as IconGrid,
 Rows as IconRows,
 Table as IconTable,

  // ── Misc ─────────────────────────────────────────────────────────────────
 Question as IconHelp,
 Lifebuoy as IconSupport,
 LinkSimple as IconLink,
 ArrowSquareOut as IconExternalLink,
 MoonStars as IconMoon,
 Sun as IconSun,
 Lightning as IconLightning,
 Sparkle as IconSparkle,
 Confetti as IconConfetti,
 Handshake as IconHandshake,
 Flag as IconFlag,
 Flag as IconFlagFill, // use weight="fill" prop for filled variant
} from '@phosphor-icons/react';

// ── Named re-export aliases for specific contexts ────────────────────────────
// Keeps semantics clear at the call site

export {
 MagnifyingGlass as SearchIcon,
 Bell as BellIcon,
 User as UserIcon,
 Gear as SettingsIcon,
 ChatCircle as MessageIcon,
 House as HomeIcon,
 Storefront as StoreIcon,
 Heart as HeartIcon,
 Star as StarIcon,
 MapPin as MapPinIcon,
 ArrowLeft as BackIcon,
 Plus as PlusIcon,
 X as CloseIcon,
 List as MenuIcon,
 CaretDown as ChevronDownIcon,
 CaretRight as ChevronRightIcon,
 CheckCircle as CheckIcon,
 WarningCircle as AlertIcon,
 CircleNotch as LoadingIcon,
} from '@phosphor-icons/react';
