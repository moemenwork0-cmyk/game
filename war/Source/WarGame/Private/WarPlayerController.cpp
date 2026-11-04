#include "WarPlayerController.h"
#include "SWarTouchControls.h"
#include "WarCharacter.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Engine/GameViewportClient.h"
#include "Engine/LocalPlayer.h"
#include "HAL/PlatformMisc.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "UnrealClient.h"
#include "ContentStreaming.h"
#include "Engine/Engine.h"
#if WITH_EDITOR
#include "AssetCompilingManager.h"
#include "ShaderCompiler.h"
#endif

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
	if (!CaptureDir.IsEmpty())
	{
		GAreScreenMessagesEnabled = false;
		int32 ResX = 1920, ResY = 1080;
		FParse::Value(FCommandLine::Get(), TEXT("-ResX="), ResX);
		FParse::Value(FCommandLine::Get(), TEXT("-ResY="), ResY);
		ConsoleCommand(FString::Printf(TEXT("r.SetRes %dx%dw"), ResX, ResY));
	}

	FString View;
	if (FParse::Value(FCommandLine::Get(), TEXT("-captureview="), View, false))
	{
		// x,y,z,pitch,yaw: a fixed camera for review shots, applied once the pawn exists.
		TArray<FString> Parts;
		View.ParseIntoArray(Parts, TEXT(","));
		if (Parts.Num() == 5)
		{
			CaptureLocation = FVector(FCString::Atof(*Parts[0]), FCString::Atof(*Parts[1]), FCString::Atof(*Parts[2]));
			CaptureRotation = FRotator(FCString::Atof(*Parts[3]), FCString::Atof(*Parts[4]), 0.f);
			bCaptureView = true;
		}
	}

	if (FParse::Param(FCommandLine::Get(), TEXT("nohud")) || !IsLocalController() || !GetLocalPlayer() || !GetLocalPlayer()->ViewportClient)
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
	if (bCaptureView && GetPawn())
	{
		GetPawn()->SetActorLocation(CaptureLocation, false, nullptr, ETeleportType::TeleportPhysics);
		GetPawn()->DisableComponentsSimulatePhysics();
		SetControlRotation(CaptureRotation);
		if (APawn* P = GetPawn())
		{
			P->SetActorEnableCollision(false);
		}
		if (ACharacter* C = Cast<ACharacter>(GetPawn()))
		{
			C->GetCharacterMovement()->SetMovementMode(MOVE_Flying);
			C->GetCharacterMovement()->StopMovementImmediately();
		}
	}

	// Hold the capture until every texture and shader has finished compiling (first run, empty DDC).
	if (!bCaptureReady)
	{
		int32 Pending = 0;
#if WITH_EDITOR
		Pending = FAssetCompilingManager::Get().GetNumRemainingAssets() + (GShaderCompilingManager ? GShaderCompilingManager->GetNumRemainingJobs() : 0);
#endif
		if (Pending > 0)
		{
			return;
		}
		IStreamingManager::Get().StreamAllResources(5.0f);
		bCaptureReady = true;
		UE_LOG(LogTemp, Display, TEXT("Capture: assets ready, warming up %d frames"), CaptureWarmup);
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
