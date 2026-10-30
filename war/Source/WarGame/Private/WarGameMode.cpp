#include "WarGameMode.h"
#include "WarCharacter.h"
#include "WarPlayerController.h"

AWarGameMode::AWarGameMode()
{
	DefaultPawnClass = AWarCharacter::StaticClass();
	PlayerControllerClass = AWarPlayerController::StaticClass();
}
