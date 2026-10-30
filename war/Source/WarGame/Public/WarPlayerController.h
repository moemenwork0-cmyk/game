#pragma once

#include "GameFramework/PlayerController.h"
#include "WarPlayerController.generated.h"

class SWarTouchControls;

UCLASS()
class WARGAME_API AWarPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AWarPlayerController();

protected:
	virtual void Tick(float DeltaSeconds) override;
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

private:
	TSharedPtr<SWarTouchControls> TouchControls;

	FString CaptureDir;
	int32 CaptureFrames = 1;
	int32 CaptureWarmup = 90;
	int32 FrameCounter = 0;
};
