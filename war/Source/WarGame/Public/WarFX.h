#pragma once

#include "GameFramework/Actor.h"
#include "WarFX.generated.h"

class UMaterialInstanceDynamic;
class UStaticMeshComponent;
class UTexture2D;

// One camera-facing flipbook sprite (Unity Labs CC0 explosion/smoke sheets) that plays its frames
// while growing, drifting and fading. Spawned in clusters by the breach director.
UCLASS()
class WARGAME_API AWarFX : public AActor
{
	GENERATED_BODY()

public:
	AWarFX();

	struct FSpec
	{
		UTexture2D* Texture = nullptr;
		int32 Cols = 5;
		int32 Rows = 5;
		float Duration = 2.f;     // seconds for the whole sheet
		float StartSize = 300.f;  // cm
		float EndSize = 900.f;
		FVector Velocity = FVector::ZeroVector;
		FLinearColor Tint = FLinearColor::White;
		float Glow = 1.f;         // emissive multiplier
		float FadeIn = 0.05f;     // fraction of life
		float FadeOut = 0.4f;
		float Delay = 0.f;
		float Alpha = 1.f;        // peak opacity
	};

	static AWarFX* Spawn(UWorld* World, UMaterialInterface* Material, const FVector& Where, const FSpec& Spec);

	UPROPERTY(VisibleAnywhere, Category = "War")
	TObjectPtr<UStaticMeshComponent> Sprite;

protected:
	virtual void Tick(float DeltaSeconds) override;

private:
	FSpec Spec;
	float Age = 0.f;
	float Roll = 0.f;

	UPROPERTY()
	TObjectPtr<UMaterialInstanceDynamic> Mid;
};
