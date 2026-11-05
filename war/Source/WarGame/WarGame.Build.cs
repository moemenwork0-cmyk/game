using UnrealBuildTool;

public class WarGame : ModuleRules
{
	public WarGame(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new[] { "Core", "CoreUObject", "Engine", "InputCore", "NavigationSystem", "AIModule" });
		PrivateDependencyModuleNames.AddRange(new[] { "Slate", "SlateCore" });
	}
}
