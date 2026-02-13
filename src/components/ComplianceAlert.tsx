import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { ScrollArea } from "./ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { 
  AlertTriangle, 
  Shield, 
  X, 
  ExternalLink,
  AlertCircle
} from "lucide-react"

interface ComplianceIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  category: 'documentation' | 'coding' | 'billing' | 'quality'
  details: string
  suggestion: string
  learnMoreUrl?: string
  dismissed?: boolean
}

interface ComplianceAlertProps {
  issues: ComplianceIssue[]
  onDismissIssue: (issueId: string) => void
  onRestoreIssue: (issueId: string) => void
  compact?: boolean
}

export function ComplianceAlert({ issues, onDismissIssue, onRestoreIssue, compact }: ComplianceAlertProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Filter issues by severity
  const activeIssues = issues.filter(issue => !issue.dismissed)
  const dismissedIssues = issues.filter(issue => issue.dismissed)
  
  const criticalIssues = activeIssues.filter(issue => issue.severity === 'critical')
  const warningIssues = activeIssues.filter(issue => issue.severity === 'warning')
  const infoIssues = activeIssues.filter(issue => issue.severity === 'info')

  const totalActiveIssues = activeIssues.length
  const hasCriticalIssues = criticalIssues.length > 0

  // Don't render if no issues
  if (issues.length === 0) return null

  const getSeverityConfig = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical':
        return {
          color: 'text-red-600 !text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: AlertTriangle,
          badgeVariant: 'destructive' as const,
          forceColor: 'rgb(220 38 38)' // Explicit red-600 value
        }
      case 'warning':
        return {
          color: 'text-orange-600 !text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: AlertCircle,
          badgeVariant: 'secondary' as const,
          forceColor: 'rgb(234 88 12)' // Explicit orange-600 value
        }
      case 'info':
        return {
          color: 'text-blue-600 !text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: Shield,
          badgeVariant: 'outline' as const,
          forceColor: 'rgb(37 99 235)' // Explicit blue-600 value
        }
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'documentation': return 'Documentation'
      case 'coding': return 'Coding'
      case 'billing': return 'Billing'
      case 'quality': return 'Quality'
      default: return category
    }
  }

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const buttonVariants = {
    tap: { 
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  }

  return (
    <TooltipProvider>
      {compact ? (
        // Compact mode for toolbar - using Popover with animations
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <motion.div
              variants={buttonVariants}
              whileTap="tap"
            >
              <Button 
                variant="ghost" 
                size="sm"
                className={`gap-1 h-8 px-2 ${
                  hasCriticalIssues 
                    ? 'text-red-600 hover:bg-red-50 hover:text-red-700' 
                    : totalActiveIssues > 0
                      ? 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                      : 'text-foreground hover:bg-muted'
                }`}
              >
                <motion.div
                  animate={totalActiveIssues > 0 ? { rotate: [0, -5, 5, 0] } : {}}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{ 
                    color: hasCriticalIssues 
                      ? 'rgb(220 38 38) !important' 
                      : totalActiveIssues > 0 
                        ? 'rgb(234 88 12) !important'
                        : 'inherit'
                  }}
                >
                  {hasCriticalIssues ? (
                    <AlertTriangle 
                      className="h-4 w-4" 
                      style={{ color: 'rgb(220 38 38) !important' }}
                    />
                  ) : totalActiveIssues > 0 ? (
                    <AlertCircle 
                      className="h-4 w-4 stroke-[2.5]" 
                      style={{ color: 'rgb(234 88 12) !important' }}
                    />
                  ) : (
                    <Shield 
                      className="h-4 w-4 stroke-[2.5]" 
                      style={{ color: 'inherit !important' }}
                    />
                  )}
                </motion.div>
                {totalActiveIssues > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Badge 
                      variant={hasCriticalIssues ? 'destructive' : 'secondary'}
                      className="text-xs px-1.5 py-0 h-4 min-w-[1rem]"
                    >
                      {totalActiveIssues}
                    </Badge>
                  </motion.div>
                )}
              </Button>
            </motion.div>
          </PopoverTrigger>

          <AnimatePresence>
            {isOpen && (
              <PopoverContent 
                className="w-[500px] p-0 border shadow-lg overflow-hidden" 
                align="start"
                side="bottom"
                sideOffset={4}
                asChild
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex flex-col h-[600px]"
                >
                  {/* Header */}
                  <motion.div 
                    className="px-6 py-4 border-b bg-background flex-shrink-0"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        <h3 className="font-medium">Compliance & Quality Review</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setIsOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>

                  <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                      {/* Active Issues */}
                      {activeIssues.length > 0 && (
                        <motion.div 
                          className="space-y-4"
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <motion.div 
                            className="flex items-center gap-2"
                            variants={cardVariants}
                          >
                            <h4 className="font-medium">Active Issues</h4>
                            <Badge variant="secondary" className="text-xs">
                              {activeIssues.length}
                            </Badge>
                          </motion.div>

                          <motion.div 
                            className="space-y-3"
                            variants={containerVariants}
                          >
                            {[...criticalIssues, ...warningIssues, ...infoIssues].map((issue, index) => {
                              const config = getSeverityConfig(issue.severity)
                              const IconComponent = config.icon

                              return (
                                <motion.div
                                  key={issue.id}
                                  variants={cardVariants}
                                  custom={index}
                                >
                                  <Card className={`${config.bgColor} border ${config.borderColor} overflow-hidden`}>
                                    <CardHeader className="pb-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                          <motion.div 
                                            className={`p-2 rounded-md bg-white/80 ${config.color}`}
                                            whileHover={{ scale: 1.05 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                          >
                                            <IconComponent 
                                              className="h-4 w-4" 
                                              style={{ color: config.forceColor + ' !important' }}
                                            />
                                          </motion.div>
                                          <div className="space-y-1">
                                            <CardTitle className={`text-sm ${config.color}`}>
                                              {issue.title}
                                            </CardTitle>
                                            <div className="flex items-center gap-2">
                                              <Badge variant={config.badgeVariant} className="text-xs capitalize">
                                                {issue.severity}
                                              </Badge>
                                              <Badge variant="outline" className="text-xs">
                                                {getCategoryLabel(issue.category)}
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                        <motion.div
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                        >
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 hover:bg-white/80"
                                            onClick={() => onDismissIssue(issue.id)}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </motion.div>
                                      </div>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-3 text-sm">
                                        <p className="text-muted-foreground">{issue.description}</p>
                                        
                                        <motion.div 
                                          className="p-3 bg-white/60 rounded-md border border-white/80"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          transition={{ delay: 0.3 + index * 0.1 }}
                                        >
                                          <div className="font-medium text-xs mb-1 text-muted-foreground uppercase tracking-wide">
                                            Details
                                          </div>
                                          <p className="text-xs">{issue.details}</p>
                                        </motion.div>

                                        <motion.div 
                                          className="p-3 bg-green-50 rounded-md border border-green-200"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          transition={{ delay: 0.4 + index * 0.1 }}
                                        >
                                          <div className="font-medium text-xs mb-1 text-green-700 uppercase tracking-wide">
                                            Suggested Action
                                          </div>
                                          <p className="text-xs text-green-800">{issue.suggestion}</p>
                                        </motion.div>

                                        {issue.learnMoreUrl && (
                                          <motion.div 
                                            className="pt-2 border-t border-white/50"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.5 + index * 0.1 }}
                                          >
                                            <motion.a 
                                              href={issue.learnMoreUrl} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className={`inline-flex items-center gap-1 text-xs hover:underline ${config.color}`}
                                              whileHover={{ x: 2 }}
                                              transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                              Learn more about this requirement
                                            </motion.a>
                                          </motion.div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              )
                            })}
                          </motion.div>
                        </motion.div>
                      )}

                      {/* Dismissed Issues */}
                      {dismissedIssues.length > 0 && (
                        <motion.div 
                          className="space-y-4 pt-4 border-t"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6, duration: 0.3 }}
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">Dismissed Issues</h4>
                            <Badge variant="outline" className="text-xs">
                              {dismissedIssues.length}
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            {dismissedIssues.map((issue, index) => {
                              const config = getSeverityConfig(issue.severity)

                              return (
                                <motion.div 
                                  key={issue.id} 
                                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-muted"
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
                                  whileHover={{ scale: 1.02 }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded ${config.bgColor} ${config.color}`}>
                                      <config.icon 
                                        className="h-3 w-3" 
                                        style={{ color: config.forceColor + ' !important' }}
                                      />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-foreground">
                                        {issue.title}
                                      </div>
                                      <div className="text-xs text-foreground/70">
                                        {getCategoryLabel(issue.category)} • {issue.severity}
                                      </div>
                                    </div>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <motion.div
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => onRestoreIssue(issue.id)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </motion.div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Remove permanently</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </motion.div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}

                      {/* No Issues State */}
                      {activeIssues.length === 0 && dismissedIssues.length === 0 && (
                        <motion.div 
                          className="text-center py-8"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
                        >
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                          >
                            <Shield className="h-12 w-12 text-green-600 mx-auto mb-3" />
                          </motion.div>
                          <h4 className="font-medium text-green-700 mb-1">All Clear!</h4>
                          <p className="text-sm text-muted-foreground">
                            No compliance issues detected in your current note.
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </ScrollArea>
                </motion.div>
              </PopoverContent>
            )}
          </AnimatePresence>
        </Popover>
      ) : (
        // Original mode for above editor - also enhanced with animations
        <div className="border-b bg-background px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <motion.div
                    variants={buttonVariants}
                    whileTap="tap"
                  >
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={`gap-2 h-8 ${
                        hasCriticalIssues 
                          ? 'text-red-600 hover:bg-red-50 hover:text-red-700' 
                          : totalActiveIssues > 0
                            ? 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                            : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <motion.div
                        animate={totalActiveIssues > 0 ? { rotate: [0, -5, 5, 0] } : {}}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        style={{ 
                          color: hasCriticalIssues 
                            ? 'rgb(220 38 38) !important' 
                            : totalActiveIssues > 0 
                              ? 'rgb(234 88 12) !important'
                              : 'inherit'
                        }}
                      >
                        {hasCriticalIssues ? (
                          <AlertTriangle 
                            className="h-4 w-4" 
                            style={{ color: 'rgb(220 38 38) !important' }}
                          />
                        ) : totalActiveIssues > 0 ? (
                          <AlertCircle 
                            className="h-4 w-4 stroke-[2.5]" 
                            style={{ color: 'rgb(234 88 12) !important' }}
                          />
                        ) : (
                          <Shield 
                            className="h-4 w-4 stroke-[2.5]" 
                            style={{ color: 'inherit !important' }}
                          />
                        )}
                      </motion.div>
                      <span className="text-sm font-medium">
                        {totalActiveIssues > 0 ? `${totalActiveIssues} Issue${totalActiveIssues > 1 ? 's' : ''}` : 'No Issues'}
                      </span>
                      {totalActiveIssues > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                          <Badge 
                            variant={hasCriticalIssues ? 'destructive' : 'secondary'}
                            className="text-xs px-1.5 py-0 h-4"
                          >
                            {totalActiveIssues}
                          </Badge>
                        </motion.div>
                      )}
                    </Button>
                  </motion.div>
                </PopoverTrigger>

                {/* Same animated content as compact mode */}
                <AnimatePresence>
                  {isOpen && (
                    <PopoverContent 
                      className="w-[500px] p-0 border shadow-lg overflow-hidden" 
                      align="start"
                      side="bottom"
                      sideOffset={4}
                      asChild
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex flex-col h-[600px]"
                      >
                        {/* Same content structure as compact mode with animations */}
                        <motion.div 
                          className="px-6 py-4 border-b bg-background flex-shrink-0"
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1, duration: 0.3 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5" />
                              <h3 className="font-medium">Compliance & Quality Review</h3>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setIsOpen(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>

                        <ScrollArea className="flex-1 overflow-y-auto">
                          <div className="p-6 space-y-6">
                            {/* Same animated content sections as compact mode */}
                            {/* Active Issues */}
                            {activeIssues.length > 0 && (
                              <motion.div 
                                className="space-y-4"
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                              >
                                <motion.div 
                                  className="flex items-center gap-2"
                                  variants={cardVariants}
                                >
                                  <h4 className="font-medium">Active Issues</h4>
                                  <Badge variant="secondary" className="text-xs">
                                    {activeIssues.length}
                                  </Badge>
                                </motion.div>

                                <motion.div 
                                  className="space-y-3"
                                  variants={containerVariants}
                                >
                                  {[...criticalIssues, ...warningIssues, ...infoIssues].map((issue, index) => {
                                    const config = getSeverityConfig(issue.severity)
                                    const IconComponent = config.icon

                                    return (
                                      <motion.div
                                        key={issue.id}
                                        variants={cardVariants}
                                        custom={index}
                                      >
                                        <Card className={`${config.bgColor} border ${config.borderColor} overflow-hidden`}>
                                          {/* Same card content as compact mode */}
                                          <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex items-start gap-3">
                                                <motion.div 
                                                  className={`p-2 rounded-md bg-white/80 ${config.color}`}
                                                  whileHover={{ scale: 1.05 }}
                                                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                >
                                                  <IconComponent 
                                                    className="h-4 w-4" 
                                                    style={{ color: config.forceColor + ' !important' }}
                                                  />
                                                </motion.div>
                                                <div className="space-y-1">
                                                  <CardTitle className={`text-sm ${config.color}`}>
                                                    {issue.title}
                                                  </CardTitle>
                                                  <div className="flex items-center gap-2">
                                                    <Badge variant={config.badgeVariant} className="text-xs capitalize">
                                                      {issue.severity}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                      {getCategoryLabel(issue.category)}
                                                    </Badge>
                                                  </div>
                                                </div>
                                              </div>
                                              <motion.div
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                              >
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0 hover:bg-white/80"
                                                  onClick={() => onDismissIssue(issue.id)}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </motion.div>
                                            </div>
                                          </CardHeader>
                                          <CardContent>
                                            <div className="space-y-3 text-sm">
                                              <p className="text-muted-foreground">{issue.description}</p>
                                              
                                              <motion.div 
                                                className="p-3 bg-white/60 rounded-md border border-white/80"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.3 + index * 0.1 }}
                                              >
                                                <div className="font-medium text-xs mb-1 text-muted-foreground uppercase tracking-wide">
                                                  Details
                                                </div>
                                                <p className="text-xs">{issue.details}</p>
                                              </motion.div>

                                              <motion.div 
                                                className="p-3 bg-green-50 rounded-md border border-green-200"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.4 + index * 0.1 }}
                                              >
                                                <div className="font-medium text-xs mb-1 text-green-700 uppercase tracking-wide">
                                                  Suggested Action
                                                </div>
                                                <p className="text-xs text-green-800">{issue.suggestion}</p>
                                              </motion.div>

                                              {issue.learnMoreUrl && (
                                                <motion.div 
                                                  className="pt-2 border-t border-white/50"
                                                  initial={{ opacity: 0 }}
                                                  animate={{ opacity: 1 }}
                                                  transition={{ delay: 0.5 + index * 0.1 }}
                                                >
                                                  <motion.a 
                                                    href={issue.learnMoreUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className={`inline-flex items-center gap-1 text-xs hover:underline ${config.color}`}
                                                    whileHover={{ x: 2 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                  >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Learn more about this requirement
                                                  </motion.a>
                                                </motion.div>
                                              )}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </motion.div>
                                    )
                                  })}
                                </motion.div>
                              </motion.div>
                            )}

                            {/* Dismissed Issues */}
                            {dismissedIssues.length > 0 && (
                              <motion.div 
                                className="space-y-4 pt-4 border-t"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6, duration: 0.3 }}
                              >
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">Dismissed Issues</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {dismissedIssues.length}
                                  </Badge>
                                </div>

                                <div className="space-y-2">
                                  {dismissedIssues.map((issue, index) => {
                                    const config = getSeverityConfig(issue.severity)

                                    return (
                                      <motion.div 
                                        key={issue.id} 
                                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-muted"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
                                        whileHover={{ scale: 1.02 }}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`p-1.5 rounded ${config.bgColor} ${config.color}`}>
                                            <config.icon 
                                              className="h-3 w-3" 
                                              style={{ color: config.forceColor + ' !important' }}
                                            />
                                          </div>
                                          <div>
                                            <div className="text-sm font-medium text-foreground">
                                              {issue.title}
                                            </div>
                                            <div className="text-xs text-foreground/70">
                                              {getCategoryLabel(issue.category)} • {issue.severity}
                                            </div>
                                          </div>
                                        </div>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <motion.div
                                              whileHover={{ scale: 1.1 }}
                                              whileTap={{ scale: 0.9 }}
                                            >
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => onRestoreIssue(issue.id)}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            </motion.div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Remove permanently</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </motion.div>
                                    )
                                  })}
                                </div>
                              </motion.div>
                            )}

                            {/* No Issues State */}
                            {activeIssues.length === 0 && dismissedIssues.length === 0 && (
                              <motion.div 
                                className="text-center py-8"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
                              >
                                <motion.div
                                  animate={{ rotate: [0, 10, -10, 0] }}
                                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                >
                                  <Shield className="h-12 w-12 text-green-600 mx-auto mb-3" />
                                </motion.div>
                                <h4 className="font-medium text-green-700 mb-1">All Clear!</h4>
                                <p className="text-sm text-muted-foreground">
                                  No compliance issues detected in your current note.
                                </p>
                              </motion.div>
                            )}
                          </div>
                        </ScrollArea>
                      </motion.div>
                    </PopoverContent>
                  )}
                </AnimatePresence>
              </Popover>
            </div>

            {!compact && totalActiveIssues > 0 && (
              <div className="text-xs text-muted-foreground">
                Review issues before finalizing
              </div>
            )}
          </div>
        </div>
      )}
    </TooltipProvider>
  )
}
