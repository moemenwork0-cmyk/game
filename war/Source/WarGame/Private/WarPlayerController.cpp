#include "WarPlayerController.h"
#include "SWarTouchControls.h"
#include "WarCharacter.h"
#include "Engine/GameViewportClient.h"
#include "Engine/LocalPlayer.h"
#include "HAL/PlatformMisc.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"

AWarPlayerController::AWarPlayerController()
{
	PrimaryActorTick.bCanEverTick = true;
}

void AWarPlayerController::BeginPlay()
{
	Super::BeginPlay();

	// Offline capture for the Kaggle renders: -capture=<dir> [-captureframes=N] [-capturewarmup=N].
	// Run with -benchmark -fps=30 so every frame advances exactly 1/30 s.
	FParse::Value(FCommandLine::Get(), TEXT("-capture="), CaptureDir);
	FParse::Value(FCommandLine::Get(), TEXT("-captureframes="), CaptureFrames);
	FParse::Value(FCommandLine::Get(), TEXT("-capturewarmup="), CaptureWarmup);

	if (!IsLocalController() || !GetLocalPlayer() || !GetLocalPlayer()->ViewportClient)
	{
		return;
	}

	TouchControls = SNew(SWarTouchControls).Controller(this);
	GetLocalPlayer()->ViewportClient->AddViewportWidgetContent(TouchControls.ToSharedRef(), 10);
	SetInputMode(FInputModeGameAndUI().SetWidgetToFocus(TouchControls));
}

void AWarPlayerController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (CaptureDir.IsEmpty())
	{
		return;
	}
	const int32 Frame = FrameCounter++ - CaptureWarmup;
	if (Frame >= CaptureFrames)
	{
		FPlatformMisc::RequestExit(false);
	}
	else if (Frame >= 0)
	{
		FScreenshotRequest::RequestScreenshot(FPaths::Combine(CaptureDir, FString::Printf(TEXT("frame_%05d.png"), Frame)), true, false);
	}
}

void AWarPlayerController::EndPlay(const EEndPlayReason::Type Reason)
{
	if (TouchControls.IsValid() && GetLocalPlayer() && GetLocalPlayer()->ViewportClient)
	{
		GetLocalPlayer()->ViewportClient->RemoveViewportWidgetContent(TouchControls.ToSharedRef());
	}
	TouchControls.Reset();
	Super::EndPlay(Reason);
}
